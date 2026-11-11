# 实现裁决（待统一纳入 PROTOCOL v1.1）

本文件记录作者在 Moon 审核 head 497b7fa 后确认的裁决；PROTOCOL.md 保持原样。本次裁决按作者直接指示执行，不触发 AGENTS.md 的协议修改流程。

## D001 — 读权限三档

- 人/看板：通过 Cloudflare Access 全读。
- agent 写 token：默认只写，不读 feed 或 watchlist。
- watchlist 基础 reader token：独立于写 token，按 agent 单独授予；只返回 symbol/name/tier/proxy，不包含 lots 或 feed。
- 当前保持拒绝带 Authorization 的 API 读请求；reader token 排到 P2。Access 和 token 的线上配置待单独确认。

## D002 — 不完整 view

缺 basis 或 invalidation 时，HTTP 400，错误码 view_incomplete，不入库。生产者使用相同 idempotency_key 补全重发，不消耗幂等键。

partial 只能由生产者声明行情数据缺失，服务端不得降级生成或改变生产者 status。

## 本次实现约定（非协议升级）

- feed 默认每页 30，limit 为 1–100 整数；cursor 为与筛选条件绑定的不透明分页位置。按实际 published_at 时间倒序、id 倒序稳定翻页，跨时区不按字符串排序；不提供快照隔离。
- q 搜索 name/symbol/title/summary/body_md，字面子串，不把 % 或 _ 当 SQL 通配符。
- events 的 from/to 为事件日期闭区间；可缺省。共享日历/关注池/规则无 agent 字段，界面明确标为共享档案；agent 产出的 feed 与 heartbeat 按来源筛选，不伪造共享档案来源。
- 新鲜度仅基于已登记 feed 的 producer 与最后 heartbeat；未知/从未投递的任务无法推断。默认 heartbeat 超时 86400 秒，可用非敏感环境配置 HEARTBEAT_MAX_AGE_SECONDS 调整；这是运行状态判断，不是交易逻辑。历史日期以该日上海结束时刻为参照，今天以当前时间为参照。
- 不新增金融计算、抓价或内容生成。lots 详情由下述 D003 本轮授权扩展；关注池列表仍不返回 lots。

## D003 — 本轮 owner 授权标的 lots 详情

owner 在手机视觉和页头压缩之后明确授权“标的详情页 lots 展示（虚构 fixture），K 线不要做”。为此增加只读 GET /v1/watchlist/{symbol}，返回 active 标的档案和该标的 lots。此为 §5 未列出的 GET 扩展，依据本轮直接授权记录，PROTOCOL.md 不变，待统一纳入 v1.1。

- 面向人/看板全读路径；当前仅本地匿名读，部署仍须先完成 Access，不配置线上鉴权。
- 生产者 Authorization 读取继续拒绝；P2 reader 不获得 lots。GET /v1/watchlist 列表不包含 lots、shares、cost。
- 缺失股数/成本保留 null，界面显示“未录入”；不计算盈亏、不合并分笔、不生成交易建议。lots 无历史时间维度，界面明确展示当前登记档案，日期/agent 过滤只影响 AI 内容。
- 仓库和本地验收只用公开协议的 demo-base / demo-topup-20260101 数字，真实分笔不入仓库。

## D004 — 服务地址私密交付（2026-11-05 主人定）

服务地址不进公开仓库，接入时随 token 一并私密交付。API 与 Agent 接入指南仅保留投递/读取地址占位符，读写分工与 token 纪律不变；撤回 step 5.1 的服务地址公开表述。该裁决只改文档，不改变线上域名、Access、代码或部署。PROTOCOL.md 保持原文，待统一升级。

## D005 — 详情以 data_raw 返回存储原文（2026-11-06 Moon 裁决，主人批准）

为保证「复制数据逐字一致」，GET /v1/feed/{id} 新增只读响应字段 data_raw，直接返回数据库中 data_json 的原始 JSON 文本，不经过解析再序列化。现有 data 解析字段、其他字段、Access + JWT 鉴权及全部写入校验保持不变。

这是只读响应扩展，不改协议信封；PROTOCOL.md 保持原文。不规则空格、换行与数字写法必须保留，并通过入库 fixture 的逐字节比对验证。data_raw 不进入列表响应，也不成为新的写入字段。


## D006 — 可配置 scope 与 reader 权限（2026-11-11 主人裁决）

本次以 api_tokens 的 SHA-256 哈希、agent、kind、scopes、期限与吊销状态进行逐请求授权，不缓存权限结论。有效凭证的 scope 不足为 403；无效、过期、吊销或 from 绑定不一致为 401。写入只允许 feed:write，reader 身份不写入。授权路由与生命周期见 [PERMISSIONS.md](PERMISSIONS.md)。

本裁决取代 D001 中“全部 Bearer 读拒绝、reader 等 P2”的临时实现：获准 reader 可读 feed/events 及 watchlist 的 symbol/name/tier/proxy 四字段；不获得 lots、数量或成本。Access 人类读取保持完整。以原生 workerd 测试锁定出参身份分级。

旧 producer secret 本版仅在无登记哈希行时兜底 feed:write，表中吊销/过期/权限不足绝不回退，数据库故障失败关闭；该回退留待后续版本移除。PROTOCOL.md 不改，本次作为获准的权限实现扩展记录。
