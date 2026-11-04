# MarketPost · 盘面邮局

我定义协议，AI 按固定格式 POST 内容到服务，服务只落库，看板只展示。数据收集与逻辑处理全在 AI 侧。

```text
生产者（AI） → Cloudflare Workers（校验、鉴权、查询） → D1
                        ↑                            ↓
                        └──── 静态看板（只展示） ────┘
```

唯一事实源为 [PROTOCOL.md](PROTOCOL.md)，原样保存审核公开版。示例全部虚构，无种子数据。本次仅 P0/P1 地基，未部署；完整待办及协议差异见 [ROADMAP](docs/ROADMAP.md)。

## 本地启动

使用 Node.js 22 或更新受 Wrangler 支持的版本、npm。

```sh
npm ci
cp .env.example .dev.vars
# 在 .dev.vars 本地填入独立生成的随机 token；不要提交、打印或分享它。
npm run db:migrate
npm run dev
```

浏览器打开开发命令输出的本地地址。D1 迁移明确使用 --local，数据保存在忽略的 .wrangler 目录。不要使用 --remote，不运行 deploy。配置中的 account_id 注释、全零 database_id 及数据库名称均为占位符，不关联真实账户。

.env.example 仅变量名，不包含凭证。每个 agent 的 token 独立生成，建议密码管理器生成至少 32 字节随机值，通过私密渠道交付，并可单独替换/吊销；未来线上只走 Worker Secrets。other:demo 映射 PRODUCER_TOKEN_OTHER_DEMO，其他 name 以此类推（小写字母数字下划线）。ENVIRONMENT 为环境标记，不充当安全开关。

examples/ 中有三份虚构 POST JSON，客户端读取本地环境凭证放入 Authorization: Bearer 请求头，Content-Type 使用 application/json。不要把凭证写进命令、JSON 或文档。相同 key 重试返回 200/deduplicated；不同 agent 的 key 以前缀区分。

```sh
npm run lint
npm test
```

lint 使用 TypeScript 严格类型检查。测试框架使用 Node 内建 node:test，测试通过 Wrangler getPlatformProxy 运行本地 D1，并随机生成内存中的测试凭证，临时数据库用后清理。不调用线上接口。已生成并纳入 package-lock.json；CI 使用 npm ci 固定依赖。

## API 与看板范围

实现 POST /v1/feed，以及 P1 GET feed 列表/详情、agents、watchlist、events、alert-rules、health/producers。feed 支持 from/type/symbol/trading_day/q/limit/cursor。接口响应与分页约定见 [API.md](docs/API.md)。commands 和 watchlist 写接口仍返回 501。

七 Tab 已接本地查询：动态 agent 及条数、日期与关键词、时间流类型/标的筛选、详情与独立观点区、持仓共享档案与已投递价格、技术面、事件、提醒。unretrieved/partial/heartbeat 断供独立展示。指令未启用；不抓行情、不计算指标、不展示分笔成本。完整 K 线与完整 §6 交互未在本次实现。

两项裁决见 [DECISIONS.md](docs/DECISIONS.md)，按作者要求保留 PROTOCOL.md 原文，待统一升 v1.1。reader token 留到 P2；view 缺依据/失效条件返回 400 view_incomplete，不入库，允许同 key 补齐重发。

## 部署前的鉴权配置（本次不执行）

Cloudflare Access 挡人读页面和 GET 接口，POST /v1/feed 对 Access 放行，只认绑定 from 的 agent token。Access 预留位置在 wrangler.toml 和 src/index.ts；应用目前不验证 Access JWT，本地匿名读接口不具备生产安全边界。禁止直接上线当前骨架。若 Access 按路径 Bypass，必须验证 GET /v1/feed 仍被保护（采用适当策略/网关方法规则），不能因 POST 放行而暴露读取。生产者 Authorization 无权读或管理。

不要将真实账户、域名、watchlist、lots、价格规则、token、Cloudflare 凭证回填到公开仓库。真实数据只存私有 D1。

## GitHub

已关联用户指定的公共仓库，main 为初始化分支。请在 在 Settings → Code security 中确认 Secret scanning 与 Push protection 已开启；不要提交密钥去测试。CI 在 push / pull_request 运行 lint + test，权限仅 contents: read。

依赖仅开发工具 Wrangler 与 TypeScript：后者用于指定 TypeScript 技术栈的编译及严格类型检查，兼任 lint，无运行时第三方依赖；测试使用 Node 自带框架。[Cloudflare 本地 D1 文档](https://developers.cloudflare.com/d1/best-practices/local-development/)与[静态资源绑定文档](https://developers.cloudflare.com/workers/static-assets/binding/)说明本地绑定和同仓静态资源机制。

## 文档

- [P1 本地验收与限制](docs/P1-VALIDATION.md)

- [Agent 接入指南](docs/AGENT-ONBOARDING.md)
