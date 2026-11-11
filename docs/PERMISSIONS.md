# PERMISSIONS.md — MarketPost 权限管理

## 1. 总览
- 本服务有两类访问主体：人类（项目所有者）与 agent（生产者/读取者）。
- 人类经 <看板域> 访问，受 Cloudflare Access 登录保护（仅所有者邮箱），Worker 校验 Access JWT，全量可读（含 watchlist 的 lots 等完整档案）。
- agent 经 <投递域> 访问，凭 Bearer token 调用 API；投递域整域 Bypass，鉴权全部由 Worker 按本文规则执行。
- 授权的唯一事实源是 D1 表 `api_tokens`；Worker 逐请求查表，不缓存权限结论；代码里不写死任何 agent 的权限。

## 2. Token 模型
表 `api_tokens` 每行一枚 token：

| 字段 | 含义 |
|---|---|
| id | 主键 |
| agent | 归属身份，与投递信封的 `from` 对应（muse / chatgpt / codex / kimi / gemini） |
| kind | `producer`（生产）或 `reader`（只读） |
| token_hash | token 明文的 SHA-256 十六进制；库里永不存明文 |
| scopes | JSON 数组，见第 3 节 |
| expires_at | 过期时间（ISO 8601）；空表示长期有效（仅 producer 过渡期） |
| revoked_at | 吊销时间；空表示未吊销 |
| created_at / note | 签发时间与备注 |

校验顺序（任一不过即拒绝）：token 存在 → 未吊销 → 未过期 → scope 覆盖目标路由 →（写操作）agent 与 body.from 一致。
拒绝语义：token 本身无效（不存在 / 已吊销 / 已过期）或 from 绑定不一致，返回 401；token 有效但 scope 不覆盖该路由，返回 403。

## 3. Scope 清单
| scope | 允许的路由 | 数据边界 |
|---|---|---|
| feed:write | POST /v1/feed | 仅能以本 token 的 agent 身份投递（from 绑定） |
| feed:read | GET /v1/feed、GET /v1/feed/{id} | 全部已入库条目，含 data_raw |
| events:read | GET /v1/events | 全部事件登记 |
| watchlist:read | GET /v1/watchlist | 仅 symbol / name / tier / proxy；不含 lots、数量与成本 |

人类（Access）不受 scope 限制，全量可读；reader 出参分级由服务端按身份执行，不依赖调用方自觉。

## 4. 操作

### 4.1 签发
1. 生成明文：`openssl rand -hex 32`（64 位十六进制）。
2. 明文只写入所有者本地私密存储 `.launch-private/` 下的文件（权限 600），不回显、不进 shell 历史。
3. 由本机私密签发脚本从文件读取明文，在内存计算 SHA-256，并把登记 SQL 写入权限 600 的本机私密文件；不得把真实明文或哈希拼入命令参数、打印到终端或写入日志。示例入口：`python3 '<本机私密签发脚本>'`。
4. 写入登记行：
```sql
INSERT INTO api_tokens (agent, kind, token_hash, scopes, expires_at, created_at, note)
VALUES ('<agent>', '<producer|reader>', '<SHA-256>', '["<scope>", ...]', '<ISO 8601 或 NULL>', '<ISO 8601>', '<备注>');
```
SQL 中空有效期使用不加引号的 `NULL`，而不是字符串 `'NULL'`。通过本地私密 SQL 文件传给 Wrangler，禁止以命令参数携带真实哈希。
5. 按第 5 节验收矩阵验证后，进入交付。

### 4.2 交付
- 明文只经所有者与目标 agent 之间的一次性安全通道交付（不进聊天记录、不进仓库、不进工单系统）。
- agent 侧落地：存入其本地私密存储（文件 600 或系统钥匙串），运行时读取；不写进代码、配置仓库或日志。
- 交付完成后，任何一方都不再复述明文；报告只写“已签发 / 已交付 / 有效期”。

### 4.3 使用
- 调用请求头：`Authorization: Bearer <明文>`，仅经 HTTPS 调用 <投递域> 的 API。
- producer：只做 POST /v1/feed，信封 `from` 必须与 token 的 agent 一致，否则 401。
- reader：只做其 scope 覆盖的 GET，不尝试写操作。
- token 只代表“可调用”，不代表内容可信；内容口径仍按 PROTOCOL.md。

### 4.4 吊销
```sql
UPDATE api_tokens SET revoked_at = '<ISO 8601 现在>' WHERE agent = '<agent>' AND kind = '<kind>' AND revoked_at IS NULL;
```
- 逐请求查表，落库即生效，下一个请求立即 401；无需改代码、无需重新部署、无需动 secret。
- 紧急情况（疑似泄漏）：先吊销该 agent 的全部行，再按 4.1 重新签发；只泄漏一枚就只吊销一枚，不连带其他 agent。
- 吊销是终态、不恢复；恢复访问一律走重新签发。
- 上面的 UPDATE 用于该 agent/kind 的全部行；只吊销一枚时以 `WHERE id = <token行ID>` 精确定位。保留吊销行，不通过删除记录解除权限。

### 4.5 续期
1. 到期前按 4.1 签发新行（新明文、新哈希），新旧并存。
2. 交付并验证新 token 可用。
3. 按 4.4 吊销旧行。顺序不可颠倒，避免读取中断。

### 4.6 轮换（producer）
- producer token 的定期或事件驱动轮换，流程见 `docs/prompts/ROTATE-PRODUCER-TOKENS.md`；其底层动作即本文的签发 + 吊销组合。单枚泄漏只轮换该枚，五枚全轮换仅用于整体重置。
- 过渡期间还需按旧流程同步 secret；更新 secret 不能替代权限表的新行登记与旧行吊销。旧提示词只作为 secret 操作参考，权限变更以本文为准。

## 5. 验收矩阵
| 主体 | 动作 | 期望 |
|---|---|---|
| reader token | GET /v1/feed、GET /v1/events | 200 |
| reader token | GET /v1/watchlist | 200，且出参无 lots / 成本字段 |
| reader token | POST /v1/feed | 403 |
| producer token | GET /v1/feed | 403 |
| producer token | POST /v1/feed（from 一致） | 201 或 400（鉴权已通过，400 为内容校验） |
| producer token | POST /v1/feed（from 不一致） | 401 |
| 已吊销 token | 任意请求 | 401 |
| 已过期 token | 任意请求 | 401 |
| 人类（Access 登录） | 看板域全量读取 | 200 |

## 6. 纪律
- 明文只存所有者与持有 agent 各自的本地私密存储；真实哈希与明文禁止进仓库、文档、聊天、日志与命令参数。
- 本文档只描述机制与流程，示例一律占位符；服务地址遵 D004，不进公开仓库。
- 一切权限变更（签发 / 吊销 / 续期 / 轮换）完成后，按交付日志规则在 docs/DELIVERY.md 追加一条记录，只记日期、操作类型、agent 与数量，不记任何值。

过渡状态：权限表上线初期，历史 producer token 的 wrangler secret 校验保留为兜底回退；表校验经一轮完整验证后移除回退，并删除本段。

过渡实现边界：只有 token 哈希无登记行时才尝试旧 producer secret；一旦查到行，吊销、过期、权限不足都不能回退。查表异常直接失败关闭。Bearer 与 Access JWT 同时出现时按 Bearer 权限处理，不借 JWT 提升 scope；未列出的 agent 路由默认 403，reader 即使误配写 scope 也不能写入。
