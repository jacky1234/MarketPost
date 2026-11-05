# 路线图（PROTOCOL §8）

本次完成 P1 查询接口与只读看板接通；不等于完成整个 P1 验收。协议保持原文。

## P0 — 本地地基已完成，远程与部署配置待确认

- [x] 已审核公开协议原样纳入 PROTOCOL.md
- [x] 协作约定、工程配置、占位迁移、CI 文件
- [x] lint + test 全部通过（11 组 Wrangler 本地 D1 测试，本轮未重跑）
- [x] main 分支首次提交完成（2a4d805）
- [x] 公共仓库 push，main 跟踪 origin/main
- [ ] 服务地址确认、token 独立生成与安全发放
- [ ] 线上 Access 策略、secret scanning 和 push protection（未执行）

## P1 — 查询与只读看板已接通，尚未完整验收

- [x] 六表及四个 feed 索引；无 seed
- [x] POST feed 信封校验、agent/token 绑定、原子幂等
- [x] GET feed 四项筛选、agents 历史/日期计数、watchlist 只读无 lots
- [x] 七 Tab、顶部横滑、日期/动态 agent 筛选、回顶实现
- [x] 必需测试用例代码（运行状态见 P0）
- [x] 本地 D1 迁移及 wrangler dev 联调验收
- [x] GET feed/{id}、events、alert-rules、health/producers
- [x] feed 的 q、limit、cursor 搜索和分页
- [x] 看板连接 DB 查询、动态 agent、搜索、六 Tab 真实只读渲染
- [x] unretrieved 原因、partial 缺项、heartbeat 断供及已加载内容观点对照展示
- [x] 手机视觉检查：owner 已提供真机截图、初步通过（2026-11-04）
- [x] 390×844 逐 Tab 有数据/空态、筛选条和回顶完整检查；当前 P1 看板视觉验收通过，证据见 P1-VALIDATION.md
- [x] 只读标的 lots 详情及虚构 fixture（本轮 owner 授权扩展）
- [ ] 完整 K 线及其余完整 §6 交互
- [ ] 人类读鉴权（待单独确认）；reader token 按 D001 排到 P2，GET API 的 Access JWT 第二道锁已实现并通过测试；Access 应用及私密生产配置仍待第 5 步确认，禁止线上使用
- [ ] 三天手工投递验收（真实数据仅私有 D1，本次不执行）

## P2 — 未开始（按 §8：生产者接入）

- [ ] 按 agent 独立授予 watchlist reader token，仅 symbol/name/tier/proxy；不含 lots/feed

- [ ] 现有五任务按 §7 接入，连续一周幂等验收
- [ ] 盘后和技术面生产者上线
- [ ] watchlist POST / PATCH / DELETE（目前 501）
- [ ] 规则管理与 command UI

## P3 — 未开始（按 §8：指令队列）

- [ ] POST / GET commands、PATCH commands/{id}（目前 501）
- [ ] pending → claimed → done/failed 与 AI 轮询、reply_to 回填
- [ ] 刷新/加标的队列联动

## P4 — 未开始，可选

- [ ] 盈亏计算开关
- [ ] 周报回测对照

## 协议差异、歧义及本次范围

- §4 为 PostgreSQL 风格 SQL：D1 使用 TEXT 存时间/JSON，DATE 使用 TEXT，now() 改为 SQLite strftime；字段、约束、四索引保持一致。
- §2.1 提及另发 watchlist 只读 token；§7.5 禁止生产者读取。本次拒绝 API 上携带 Authorization 的读取/管理请求；匿名本地 GET 可用。正式人类读鉴权、专用只读 token 未实现。
- §9 建议 FastAPI；初始化要求已指定 TypeScript Workers，且该条允许替换。本次使用指定技术栈。
- §8 P1 为完整展示；本次补齐查询并接通只读看板，commands/watchlist 写接口仍 501。§5 将 commands 标 P2、§8 将队列标 P3，沿用 §8 主阶段并记录此差异。
- §2.7 已由 DECISIONS.md D002 裁决：缺 basis/invalidation 返回 400 view_incomplete、不入库；同 key 补齐重发，服务端不得生成 partial。
- §2.2 未逐一声明所有示例字段可空性：核心文本、时间、容器要求完整；market/tier 可空，heartbeat 的 trading_day 可 null。other:<name> 本地映射限制 name 为小写字母数字及下划线。
- 幂等键采用完整 from + ':' 前缀；避免 other:<name> 被拆分误认，未绑定自然语言 key 模板。
- unretrieved 原因是否充分、新闻/财报正文的语义分类、美东日期独立字段未有明确机器格式。本次只做信封/结构校验，不推断事实或内容语义；公告强制来源，其他来源项存在时逐项校验。

## 第 4 步上线配置准备

- Cloudflare 标识与服务地址由主人私下保管。
- 第 5 步已部署，服务地址由主人私下保管。

## 第 5 步部署状态

- 已部署，服务地址由主人私下保管。

## Step 5.1：投递口拆分

- 已增加独立投递自定义域并重新部署，保留看板读取域；服务地址由主人私下保管。
- ACCESS_* 与现有 token 不变；不再依赖看板域按路径 Bypass 区分读写。
- 新投递入口：带 muse token POST 201、匿名 GET 401、无 token POST 401；虚构 smoke 使用 2099-01-01。

## 文档隐私回退

- 服务地址由主人私下保管；公开接入文档恢复占位，线上读写分工不变。
