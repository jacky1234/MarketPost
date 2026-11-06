# 事件 Tab 验收

本轮只改前端，复用已有 GET /v1/events 的 from/to；不改协议、写入校验、Access、producer token 或数据库结构。真实事件仅由主人本机未跟踪 SQL 登记，公开仓库和截图不包含真实种子。

- `npm run lint` 通过；`npm test` 全套 31/31 通过，其中新增 5 项事件模型/读取测试。
- 日期测试覆盖上海午夜、跨年/闰日、今天/明天/第 30 天边界、排序分组、单日过滤、最近未来提示、近 7 天范围与输入状态不改写。
- 独立 Chrome 使用固定的虚构日期与 09999.HK 响应，测试默认即将到来、手动日期切换、当日有/无事件、30 天外最近提示、完全无未来事件、已过 upcoming 灰显与默认折叠。无 pageerror。
- 390×844 四场景量测 `document.documentElement.scrollWidth=390`，均无页面级横向滚动，截图已人工复核。
- 既有 390/360 看板浏览器回归通过，包含七 Tab、Markdown/原文复制、本地 D1 详情链路、状态区及桌面分页计数；回归截图输出临时目录，保留上一轮证据。

浏览器检查使用独立安装的 Playwright 和系统 Chrome，不新增项目依赖：本地 `npm run dev` 启动后，执行 `PLAYWRIGHT_MODULE=<本机模块入口> node tests/events-browser.mjs`。该脚本拦截全部 API 请求，截图只含虚构数据。

- [即将到来](screenshots/events/390-upcoming.png)
- [已过事件展开](screenshots/events/390-recent.png)
- [单日为空](screenshots/events/390-day-empty.png)
- [30 天外最近事件](screenshots/events/390-far-empty.png)
- [量测结果](screenshots/events/results.json)

范围采用上海今日至今日 +30 天闭区间（日期差 0–30）；近 7 天指今日 -7 至昨日。倒计时是登记日期差，不表示事件时区中的具体时刻。空态提示的「未来」也以上海今日为起点，不以选中的历史/未来筛选日为起点。

登记步骤见 [API 文档的事件登记](API.md#事件登记)。线上展示仍请主人登录看板后复核；本轮不向生产库写入测试 fixture。
