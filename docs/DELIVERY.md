# 初始化交付记录

状态：已部署，服务地址由主人私下保管。原稿未复制或改写，协议来自已审核的可公开版。

## 文件树

```text
.
├── .env.example
├── .github/workflows/ci.yml
├── .gitignore
├── AGENTS.md
├── CHANGELOG.md
├── PROTOCOL.md
├── README.md
├── docs/
│   ├── DELIVERY.md
│   └── ROADMAP.md
├── examples/
│   ├── chatgpt-post-market.json
│   ├── codex-post-market.json
│   └── muse-post-market.json
├── migrations/0001_init.sql
├── package-lock.json
├── package.json
├── public/
│   ├── app.js
│   ├── index.html
│   └── style.css
├── src/
│   ├── index.ts
│   ├── types.ts
│   └── validation.ts
├── tests/feed.test.mjs
├── tsconfig.json
└── wrangler.toml
```

本地 .test-build 为忽略的临时运行产物，不属交付源码。

## 验证

- 通过：PROTOCOL.md 与审核公开版逐字节一致。
- 通过：npm run lint（TypeScript 严格类型检查）。
- 通过：npm test，11 组测试全部在 Wrangler 本地 D1 通过：信封/缺 from、枚举和来源、token/from、重复幂等/跨 agent、非法 JSON 和缺 token、watchlist 不返回 lots/拒绝生产者读取、501 占位路由。
- 通过：wrangler d1 migrations apply DB --local，0001_init.sql 成功。
- 通过：wrangler dev 本地回环 HTTP 验证，页面与静态资源、feed/agents/watchlist GET、501 占位、无 token POST 拒绝；结束后已关闭开发进程。
- 手机视觉检查：owner 真机初检后，已补独立 Chrome 390×844 七 Tab 有数据/空态、筛选条及回顶检查，当前 P1 看板视觉验收完整通过（2026-11-04）；证据见 P1-VALIDATION.md。
- 未执行：真实数据三天验收、部署与线上配置。
- 已生成 package-lock.json，CI 使用 npm ci + lint + test。

## Git 与 push

- main 分支已完成首次提交：2a4d80528548ec52ace5fca885ed4c7a5f328c23。
- 首次提交信息：chore: initialize MarketPost skeleton (protocol v1, P0/P1 foundation)
- 使用项目通用提交身份，未将本机账号身份写入提交元数据。
- 已将首次提交推送到用户提供的公共仓库，main 跟踪 origin/main。未另建仓库；后续文档提交 hash 见最终交付回复。

## 未完成与协议差异

完整清单见 ROADMAP.md。P0 还欠服务地址/token 发放确认；P1 查询接口和只读看板已接通，仍欠完整 K 线及其余 §6 交互、人类鉴权及三天私有数据验收；P2–P4 未开始。

协议差异包括 SQLite 类型与时间默认值适配、两处 agent 读权限描述、部分观点退回的响应歧义、P1 地基范围、commands 阶段标注差异、信封可空性及幂等前缀解释，均在 ROADMAP.md 逐项记录。未修改 PROTOCOL.md。

## 后续需要提供或恢复

- 后续部署时在私有配置提供 Cloudflare account_id、D1 database_id、拟用服务地址；本次保持占位。
- 每 agent 独立随机 token 的私密发放渠道，建议密码管理器生成至少 32 字节；真实值只填本地忽略文件或 Secrets。
- 正式部署前单独确认部署与 Access 读保护/POST 放行策略，启用 GitHub secret scanning 和 push protection。

依赖理由：Wrangler 为指定工具；TypeScript 为指定语言的编译和严格类型检查工具；测试采用 Node 内置 node:test，无运行时第三方依赖。

## P1 后续交付

两项裁决见 DECISIONS.md；接口约定见 API.md；本次验收和限制见 P1-VALIDATION.md。两笔提交分别为查询接口/裁决/测试与只读看板，hash 见交付回复。PROTOCOL.md 原文保持不变。本轮沿用已通过的 lint 和 11 组 D1 测试，不重复跑测试套件。

## 顺序收尾：第一项

- 手机视觉自检与修复已完成：修复深链接选中 Tab 不在横滑可视区。
- 本项提交前 npm run lint 通过；npm test 全套 11/11 通过。
- 当前 P1 看板视觉通过，不扩大为 Access/生产投递/完整 §6 验收。

## 顺序收尾：第二项

- 页头压缩与全局筛选吸顶已完成，仅 HTML/CSS 改动；390×844 截图和吸顶/筛选交互检查通过。
- 本项提交前 npm run lint 通过；npm test 全套 11/11 通过。
- 不修改查询、鉴权、投递行为；不部署。

## 顺序收尾：第三项

- 标的只读 lots 详情已完成，虚构 fixture；关注池列表仍无 lots/成本，生产者写 token 无读取权限。
- 本项提交前 npm run lint 通过；npm test 全套 12/12 通过。
- 独立 Chrome 390×844 的有数据/空态/缺失值/失败重试检查通过，截图见 P1-VALIDATION.md。
- 当前登记的共享持仓档案独立于 AI 内容的日期/agent 筛选；不计算盈亏、不实现 K 线。
- 三项均以独立提交推送；准确 hash 以最终交付回复与 git log 为准，无未提交功能草稿。

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

## Step 5.2：Access JWT 401 诊断与修复（2026-11-05）

- 证据 1：实际生效 Worker 的 ACCESS_TEAM_DOMAIN / ACCESS_AUD 与本地逐字一致，生产环境正确；看板域 cloudflared 登录票据的 AUD 匹配，标准化 issuer 匹配，未过期。未改 AUD、团队域或 Access 应用。真实票据只留私密文件/本地登录缓存。
- 证据 2：修复前真实 JWT 的 assertion-only GET 和附 Access Cookie 的 GET 均为 401。
- 证据 3：wrangler tail 关联单次 feed 请求，捕获固定失败码 jwks_fetch_failed。本机 Web Crypto 验签正确；原生 workerd 实际构造 JWKS Request 时可复现失败。
- 根因：此前 JWKS fetch 使用 redirect:error，workerd 不支持该值，在请求构造阶段抛 TypeError，尚未发起网络请求。修复为 manual，并继续拒绝所有非 2xx（包括 3xx），不放松 issuer/aud/签名/时间校验。参见 [Cloudflare Request 文档](https://developers.cloudflare.com/workers/runtime-apis/request/)。
- 修复保留仅固定原因码的拒绝日志，不记录 JWT、Cookie、声明值、身份、域名或完整请求。
- 修复后：真实 JWT GET limit=1 为 200，按 2099-01-01 查询为 200 且能读到 smoke；匿名 GET 仍为 Access 302；投递域带 muse token POST 201、匿名 GET 401、无 token POST 401。新增虚构 smoke 的 tags=[smoke]，trading_day=2099-01-01，验收后由主人清理。
- lint 通过；完整测试 24/24 通过，新增原生 workerd 正向验签、JWKS 跳转拒绝与诊断日志脱敏回归。仅使用 Wrangler 已锁定的原生运行时依赖，无新增依赖。
- 已重新部署修复；服务地址由主人私下保管。协议、提交版占位配置、Access 策略与既有 agent token 不变。


## 看板体验优化（2026-11-06）

- 已完成安全 Markdown、结构化 signals、body_md/data_raw 原文复制、手机筛选栏与全屏详情、状态折叠、内容计数/空态、今日发布视角。
- 新增可选 published_day（上海日期，与 trading_day 可组合）；按 D005 新增详情 data_raw，只读返回存储 JSON，现有 data 不变。
- lint 与全套 26/26 测试通过；390×844、360×844 逐 Tab 测量无页面横向溢出，桌面状态卡片和分页计数通过。本地真实 D1/API 到复制按钮的原文比对通过。
- 详细验证与截图见 [看板体验验证](P1-EXPERIENCE-VALIDATION.md)；实际手机剪贴板权限、Safari 安全区与软键盘待主人复核。
- PROTOCOL.md、信封校验、Access 与 producer token 不变；无新增依赖。本轮重新部署结果与时间见交付回复，服务地址由主人私下保管。


## 事件 Tab：即将到来与本地登记

- 完成默认未来 30 天、按日分组与上海日期倒计时；保留单日筛选、最近未来事件提示、近 7 天已过折叠灰显。
- 复用现有 events 查询；登记由主人在本机执行未跟踪 SQL，公开说明只用虚构示例，不收录真实种子。
- lint、完整测试 31/31 与 390 宽浏览器检查通过；既有 390/360 看板回归通过，证据见 [事件验收](EVENTS-VALIDATION.md)。
- 本轮提交与重新部署时间见交付回复；服务地址由主人私下保管。
