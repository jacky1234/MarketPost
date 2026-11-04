# P1 本地实现与验收记录（2026-11-04）

## 已完成的本地实现

- DECISIONS.md 记录两项裁决；PROTOCOL.md 未修改。
- 查询详情、events、alert-rules、health/producers、q/limit/cursor。
- view_incomplete 400 拒绝，不入库，原 key 补全重发；不自动生成 partial。
- 六个只读 Tab 连接本地 API、动态 agent、日期/关键词、类型/标的筛选、详情、缺失/断供状态、错误重试与 URL 回退。指令未启用。
- tests/fixtures/board.sql 仅为本地视觉验收的虚构数据。

## 验证状态

- npm run lint：通过。
- npm test：11/11 本地 D1 测试通过。
- 历史记录：owner 已提供真机截图、初步通过（2026-11-04）。
- 本轮补充：独立 Playwright + 本机 Chrome，390×844，七 Tab 有数据/空态逐一截图自检通过；筛选条无横溢，回顶完整位于屏内且可点击回顶，P1 本轮范围的手机视觉验收完整通过。
- 手机视觉通过仅指当前已实现的 P1 看板，不代表 Access、生产投递或完整 §6 功能已验收。
- 查询接口、裁决与对应测试为第一笔提交；只读看板及相关文档/虚构验收数据为第二笔提交，hash 见交付回复。
- 未部署，未操作 Cloudflare Access、线上 token 或账号配置。

## 仍需执行

后续完善剩余完整 §6 功能；本轮按 owner 新要求，每项提交前运行一次 lint + test。

当前界面仍有限制：Markdown 安全按原文展示；观点对照仅覆盖当前已加载条目；完整 K 线、lots 成本详情未实现。API 与共享档案归属约定见 API.md、DECISIONS.md。

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
