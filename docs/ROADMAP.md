# 路线图（PROTOCOL §8）

本次仅 P0/P1 地基；完成文件不等于完成整个 P1 验收。协议保持原文。

## P0 — 本地地基已完成，远程与部署配置待确认

- [x] 已审核公开协议原样纳入 PROTOCOL.md
- [x] 协作约定、工程配置、占位迁移、CI 文件
- [x] lint + test 全部通过（7 组 Wrangler 本地 D1 测试）
- [x] main 分支首次提交准备完成（提交 hash 见交付回复）
- [ ] 公共仓库 push（REMOTE_URL 未提供）
- [ ] 服务地址确认、token 独立生成与安全发放
- [ ] 线上 Access 策略、secret scanning 和 push protection（未执行）

## P1 — 地基代码已写，尚未完整验收

- [x] 六表及四个 feed 索引；无 seed
- [x] POST feed 信封校验、agent/token 绑定、原子幂等
- [x] GET feed 四项筛选、agents 历史/日期计数、watchlist 只读无 lots
- [x] 七 Tab 静态空壳、顶部横滑、日期/agent 演示筛选、回顶
- [x] 必需测试用例代码（运行状态见 P0）
- [x] 本地 D1 迁移及 wrangler dev 联调验收
- [ ] GET feed/{id}、events、alert-rules、health/producers（目前均 501）
- [ ] feed 的 q、limit、cursor（暂返回 400 明确未实现）
- [ ] 看板连接 DB 查询、动态 agent、搜索、六 Tab 真实只读渲染
- [ ] unretrieved 原因、partial 缺项、heartbeat 断供及观点对照展示
- [ ] 人类读鉴权与专用只读 token；当前仅预留 Access 位置，禁止线上使用
- [ ] 三天手工投递验收（真实数据仅私有 D1，本次不执行）

## P2 — 未开始（按 §8：生产者接入）

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
- §8 P1 为完整展示，本次用户明确缩小到地基；未实现 API 返回 501，看板不连接数据。§5 将 commands 标 P2、§8 将队列标 P3，沿用 §8 主阶段并记录此差异。
- §2.7 “打回 partial”未定义 HTTP/响应格式。本次缺 basis/invalidation 返回逐字段 400，错误说明 partial 并要求生产者补齐，不擅自更改生产者内容。
- §2.2 未逐一声明所有示例字段可空性：核心文本、时间、容器要求完整；market/tier 可空，heartbeat 的 trading_day 可 null。other:<name> 本地映射限制 name 为小写字母数字及下划线。
- 幂等键采用完整 from + ':' 前缀；避免 other:<name> 被拆分误认，未绑定自然语言 key 模板。
- unretrieved 原因是否充分、新闻/财报正文的语义分类、美东日期独立字段未有明确机器格式。本次只做信封/结构校验，不推断事实或内容语义；公告强制来源，其他来源项存在时逐项校验。
