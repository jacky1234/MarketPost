# 初始化交付记录

状态：P0/P1 本地地基已初始化并通过验证；无部署、无 Cloudflare 账号操作。原稿未复制或改写，协议来自已审核的可公开版。

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
- 通过：npm test，7 组测试全部在 Wrangler 本地 D1 通过：信封/缺 from、枚举和来源、token/from、重复幂等/跨 agent、非法 JSON 和缺 token、watchlist 不返回 lots/拒绝生产者读取、501 占位路由。
- 通过：wrangler d1 migrations apply DB --local，0001_init.sql 成功。
- 通过：wrangler dev 本地回环 HTTP 验证，页面与静态资源、feed/agents/watchlist GET、501 占位、无 token POST 拒绝；结束后已关闭开发进程。
- 未执行：页面浏览器视觉检查；真实数据三天验收、部署与线上配置。
- 已生成 package-lock.json，CI 使用 npm ci + lint + test。

## Git 与 push

- main 分支已由用户初始化；本地验证通过后执行首次提交，commit hash 见最终交付回复或 git rev-parse HEAD。
- 首次提交信息：chore: initialize MarketPost skeleton (protocol v1, P0/P1 foundation)
- 使用项目通用提交身份，未将本机账号身份写入提交元数据。
- push 未执行：REMOTE_URL 未提供，当前无 remote；未创建远程仓库。

## 未完成与协议差异

完整清单见 ROADMAP.md。P0 还欠远程配置与服务地址/token 发放确认；P1 还欠详情/事件/提醒/新鲜度等 501 接口、查询扩展、实际看板渲染、人类鉴权及三天私有数据验收；P2–P4 未开始。

协议差异包括 SQLite 类型与时间默认值适配、两处 agent 读权限描述、部分观点退回的响应歧义、P1 地基范围、commands 阶段标注差异、信封可空性及幂等前缀解释，均在 ROADMAP.md 逐项记录。未修改 PROTOCOL.md。

## 后续需要提供或恢复

- 公共仓库 REMOTE_URL；无需提供账号身份或凭证到文档。
- 后续部署时在私有配置提供 Cloudflare account_id、D1 database_id、拟用服务地址；本次保持占位。
- 每 agent 独立随机 token 的私密发放渠道，建议密码管理器生成至少 32 字节；真实值只填本地忽略文件或 Secrets。
- 正式部署前单独确认部署与 Access 读保护/POST 放行策略，启用 GitHub secret scanning 和 push protection。

依赖理由：Wrangler 为指定工具；TypeScript 为指定语言的编译和严格类型检查工具；测试采用 Node 内置 node:test，无运行时第三方依赖。
