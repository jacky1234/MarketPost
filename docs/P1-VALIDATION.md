# P1 本地实现与验收记录（2026-11-04）

## 已完成的本地实现

- DECISIONS.md 记录两项裁决；PROTOCOL.md 未修改。
- 查询详情、events、alert-rules、health/producers、q/limit/cursor。
- view_incomplete 400 拒绝，不入库，原 key 补全重发；不自动生成 partial。
- 六个只读 Tab 连接本地 API、动态 agent、日期/关键词、类型/标的筛选、详情、缺失/断供状态、错误重试与 URL 回退。指令未启用。
- tests/fixtures/board.sql 仅为本地视觉验收的虚构数据。

## 验证状态

- npm run lint：通过。
- 最新 npm test：12/12 本地 D1 测试通过；第一、二项提交前分别为 11/11，第三项新增 lots 测试。
- 历史记录：owner 已提供真机截图、初步通过（2026-11-04）。
- 本轮补充：独立 Playwright + 本机 Chrome，390×844，七 Tab 有数据/空态逐一截图自检通过；筛选条无横溢，回顶完整位于屏内且可点击回顶，P1 本轮范围的手机视觉验收完整通过。
- 手机视觉通过仅指当前已实现的 P1 看板，不代表 Access、生产投递或完整 §6 功能已验收。
- 查询接口、裁决与对应测试为第一笔提交；只读看板及相关文档/虚构验收数据为第二笔提交，hash 见交付回复。
- 未部署，未操作 Cloudflare Access、线上 token 或账号配置。

## 仍需执行

后续完善剩余完整 §6 功能；本轮按 owner 新要求，每项提交前运行一次 lint + test。

当前界面仍有限制：Markdown 安全按原文展示；观点对照仅覆盖当前已加载条目；完整 K 线未实现；lots 详情见下述第三项。API 与共享档案归属约定见 API.md、DECISIONS.md。

## 手机视觉细项（第一项）

- 日期：2026-11-04；浏览器为独立无用户资料的 Chrome，视口 390×844，deviceScaleFactor=1、移动触摸模式。
- 数据：8787 为公开协议虚构 fixture，8788 为独立空 D1；无真实数据、账号、token 或 Cloudflare 操作。
- 七 Tab 的初始页头/筛选条与内容/空态均已截图；[有数据联系表](screenshots/mobile/filled-gallery.png)、[空态联系表](screenshots/mobile/empty-gallery.png)。原图按 filled/empty + 0–6 + top/content 命名。
- [回顶截图](screenshots/mobile/back-to-top.png)：完整处于视口右下角，点击可回顶；[来源筛选](screenshots/mobile/agent-filter.png)、[错误态](screenshots/mobile/request-error.png)。
- 发现并修复：URL 直接打开后部 Tab 时选中项横向不可见；现在渲染时将选中项滚入横滑栏可见范围，不改变页面纵向位置。
- 额外核对：来源筛选、URL 回退、partial/unretrieved/heartbeat 断供、HTTP 失败及重试，浏览器无未捕获 JS 异常。机器检查结果在 screenshots/mobile/results.json。
- 手动重现工具 tests/mobile-visual.mjs；Playwright 安装在临时目录（通过 PLAYWRIGHT_MODULE 指向模块），未加入项目依赖。

## 页头与吸顶（第二项）

- 仅调整 HTML/CSS：压缩标题、口号和 Tab 间距；全局日期/agent/搜索筛选条移至 header 外独立 sticky 容器，避免被 header 高度限制。
- 390×844 测得页头 172.78px、筛选条 149px；滚动后筛选条 top=0，所有筛选字段在屏内，来源筛选仍正确生效，无横向溢出或浏览器异常。
- [页头截图](screenshots/compact/top.png)、[吸顶截图](screenshots/compact/sticky.png)、[筛选后截图](screenshots/compact/filtered.png)，测量记录见同目录 results.json。

## 标的 lots 详情（第三项）

- 持仓 Tab 的“查看标的详情 / 分笔持仓”打开只读详情弹层，展示 lot_id、股数、成本、备注和用户登记规则；NULL 显示“未录入”，不猜币种、不计算盈亏。
- 接口 GET /v1/watchlist/{symbol} 是本轮 owner 授权扩展，见 DECISIONS.md D003；列表无 lots/成本，写 token 继续禁读。
- fixture 仅使用公开协议中的 demo-base（500 / 50）、demo-topup-20260101（200 / 42），ABCD.US 用于未录入空态。
- 390×844 逐项截图：[两笔持仓](screenshots/lots/populated.png)、[空态](screenshots/lots/empty.png)、[缺失值](screenshots/lots/missing-values.png)、[失败态](screenshots/lots/error.png)。重试、关闭/重开均通过，无横向溢出或 JS 异常。缺失值截图为浏览器临时 mock，不写入持仓数据库。
- 本项提交前 lint 通过；完整测试 12/12 通过（包含隔离、NULL、列表不泄漏、生产者无读权限、未知与停用标的）。
- 不做 K 线，不改变 Access/token 配置，不部署。
