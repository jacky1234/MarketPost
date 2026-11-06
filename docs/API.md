# P1 查询约定

## 生产地址（step 5.1）

服务地址不进公开仓库。以下仅说明读写分工，真实地址由主人在接入时随 token 一并私密交付。

- 投递：`POST <投递地址>/v1/feed`，地址由主人接入时私下提供，仅使用绑定 from 的 agent Bearer token。
- 读取与看板：`<看板/读取地址>`（由主人私下提供），浏览器 GET API 同源请求，经过 Access 登录并由 Worker 再验证 JWT。
- 投递域的匿名 `GET /v1/feed` 仍返回 401，不向 agent 暴露读取能力；无 token 的 POST 同样 401。
- Access 按路径匹配不区分 HTTP 方法，因此不再为看板域的 `/v1/feed` 配置路径 Bypass。主人已将投递 Bypass 应用迁至独立投递域（无路径）；本次不修改 Access 应用或 ACCESS_*。

服务已部署。GET /v1/* 在非 local/test 环境必须通过 Access JWT 签名/issuer/aud/时效校验，否则 401；本地/测试无 assertion 时保持匿名兼容，有 assertion 时必须有效。所有带 Authorization 的读取继续拒绝。生产者 token 只能 POST feed。reader token 等 P2，见 DECISIONS.md。

- GET /v1/feed：from/type/symbol/trading_day 精确匹配；可选 published_day=YYYY-MM-DD 按 published_at 的上海日期过滤，可与 trading_day 组合；缺省行为不变。q 对名称、代码、标题、摘要、正文做字面子串搜索；limit 默认 30，范围 1–100；cursor 与当前筛选条件绑定。响应 {items, next_cursor}，next_cursor=null 表示结束。下一页保持筛选原样，把 next_cursor 作为 cursor 传回。按实际发布时间与 id 倒序，urgent 的列表置顶由时间流在已加载内容内展示。
- GET /v1/feed/{id}：返回完整信封，并增加只读响应字段 data_raw，直接以字符串返回数据库 data_json 原文，不解析再序列化；现有 data 解析字段保持不变。正常写入的 JSON null 对应 data_raw 为字符串 "null"，历史 SQL NULL 对应 null。该字段不属于 POST 信封，列表响应不增加此字段；不存在 404。见 DECISIONS.md D005。
- GET /v1/agents?trading_day=YYYY-MM-DD：当天出现过的 agent 与条数，缺日期时汇总历史。响应 {agents:[{from,count}]}。
- GET /v1/watchlist：共享 active 关注池，不返回 lots/成本；不是 P2 的基础 reader 投影。
- GET /v1/watchlist/{symbol}：owner 本轮授权的只读标的详情扩展，响应 {item,lots}；仅 active 标的，未知/停用 404；lots 按标的隔离、NULL 原样保留。与其他人类本地读接口一样，带 Authorization 的请求拒绝。部署后须由 Access 保护；P2 reader 不获 lots。
- GET /v1/events?from=YYYY-MM-DD&to=YYYY-MM-DD：按 event_date 闭区间；响应 {items}，按事件日和 id 排序。
- GET /v1/alert-rules：共享规则登记，响应 {items}；condition_json 解码为 condition，不执行条件、不更新规则。
- GET /v1/health/producers?trading_day=YYYY-MM-DD&from=agent：已知 producer 的最近 heartbeat。响应 {reference_at,max_age_seconds,producers}；每项含 from/producer/state/last_heartbeat_at/last_published_at/age_seconds/note。state 为 fresh/stale/missing/failed/skipped/unknown。默认超时 86400 秒，非敏感环境变量 HEARTBEAT_MAX_AGE_SECONDS 可覆盖。历史日使用上海当日结束时间与当前时间的较早值。没有投递过的任务无法判断。
- 无效分页/日期/cursor：400，code=invalid_query；存储失败：500，不回显 SQL/凭证。
- 不完整观点：400，code=view_incomplete，逐字段 errors；不入库、不消耗幂等键，补全后同 key 重发。服务端永不生成 partial。

trading_day 只过滤归档交易日，published_day 只过滤上海发布日期，二者独立。看板「今日发布」模式跨归档交易日展示当天发布内容，仍标注每条交易日；heartbeat 仅展示在生产者状态区，不计入内容条数与来源选择器计数。分页不保证插入过程中的快照隔离。共享表不具有 agent 归属，界面单独标注。

看板正文通过 DOM 节点渲染标题、列表、加粗、代码与链接，不解释原文 HTML；正文与来源链接仅放行 http/https，其余按文本转义。详情的观点对照限当前已加载同日同标的其他 agent 内容。持仓页通过只读标的详情弹层展示当前登记分笔（不是历史日或 agent 归属数据）；技术面展示生产者已计算字段与信号，完整 K 线图仍待后续实现。

## 本地虚构数据验收

```sh
npm ci
npm run db:migrate
npx wrangler d1 execute DB --local --file tests/fixtures/board.sql
npm run dev
```

打开本机页面并选择 2026-11-03；SQL 仅用于本地，含多 agent、未查到/部分缺失、历史 heartbeat 超时、技术报告、事件与规则。无线上 seed 流程、无真实凭证或私有数据。

## JWT 运行时兼容与诊断

JWKS 使用 redirect:manual，并拒绝非 2xx 响应，不跟随任何跳转。workerd 不支持 redirect:error；已添加原生 workerd 回归测试，避免只在 Node mock 中通过。生产拒绝日志仅输出 access_jwt_rejected 与固定原因码，不记录票据、声明值或身份。
