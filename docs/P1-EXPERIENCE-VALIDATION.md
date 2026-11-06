# 看板体验验证（2026-11-06）

PROTOCOL.md、信封校验、Access 校验与 producer token 均不改动。所有浏览器数据均为本地虚构响应，未向生产库写入验收数据。无新增项目依赖。

## 对照验收

| 项目 | 验证方式与结果 |
| --- | --- |
| Markdown | Chrome DOM 断言标题、列表、加粗与链接；HTML/script 保持文本，危险协议不生成链接，无脚本执行。实现为 DOM 构造的轻量子集，支持标题、列表、加粗、链接、行内/围栏代码，不解释 HTML。 |
| signals | 总览与详情均断言独立信号行、name/condition/meaning 分段及 level 色点；文本安全赋值。 |
| 复制 | body_md 原文与捕获的 Clipboard 写入值逐字比较；降级 textarea/execCommand 路径及 1.5 秒恢复文案通过。data_raw 的浏览器复制参数比对通过；D1 fixture 以不规则空格、换行、指数/负零数字写法入库，详情返回值与存储文本逐字节一致，现有 data 解析字段不变。该只读扩展已按 D005 授权。 |
| 手机布局 | 独立 Chrome，390×844 与 360×844，纵向全行筛选、日期前后日、紧凑页头、横滑 Tab、状态默认折叠、详情全屏和固定关闭通过。长 JSON 不撑宽；可见按钮、输入、选择器、summary、链接宽高均至少 40px；数字使用 tabular-nums。桌面保留状态卡片。 |
| 计数与空态 | 60 条内容加 heartbeat、跨两页 API 响应，来源合计 60、单 agent 30；首批显示 50、继续加载后 60，heartbeat 不计数。无内容且有健康记录时显示明确说明；状态继续可见。来源计数从同一查询的全部页汇总，忽略当前来源选择，按来源筛选展示；以更多查询换取一致的计数口径，未增加计数接口。 |
| 今日发布 | D1 测试覆盖上海零点前后、与交易日组合、非法/空日期、cursor 日期绑定；未传参数保持旧查询行为。浏览器断言今日发布包含归档在其他交易日的内容，卡片保留交易日。 |
| 横向滚动 | 两个宽度逐一点击七 Tab，量测 document.documentElement.scrollWidth ≤ innerWidth；选中 Tab 完整位于可视范围。详情与长 JSON 同样量测。无 pageerror。 |

## 可复现命令与证据

常规检查：`npm run lint` 通过；`npm test` 全套 26/26 通过。

浏览器检查独立于 Node/D1 套件；不纳入 CI 的原因是本机使用独立安装的 Playwright 与系统 Chrome，项目不引入浏览器依赖：

```sh
npm run dev
# 另一个终端；PLAYWRIGHT_MODULE 指向本机已安装的 Playwright ESM 入口
PLAYWRIGHT_MODULE=<本机模块地址> node tests/frontend-experience.mjs
# 已按 docs/API.md 导入本地 fixture 时，再检查真实 API 到复制按钮的链路
LOCAL_FIXTURE_CHECK=1 PLAYWRIGHT_MODULE=<本机模块地址> node tests/frontend-experience.mjs
```

截图与量测摘要：

- [390 总览](screenshots/experience/390-overview.png)、[390 详情](screenshots/experience/390-detail.png)
- [360 总览](screenshots/experience/360-overview.png)、[360 详情](screenshots/experience/360-detail.png)
- [本地 D1 真实接口详情截图](screenshots/experience/390-local-d1-detail.png)
- [浏览器断言结果](screenshots/experience/results.json)

截图中的 HTML 与危险链接是安全测试输入，作为文本显示属预期。

## 真机复核边界

已完成 Chrome 手机视口验证；仍需主人在实际手机/Safari 复核系统剪贴板授权与降级、地址栏/安全区变化、软键盘弹起后的详情关闭及日期选择器。当前复制测试捕获的是 Clipboard API 写入参数，未声称完成手机系统剪贴板实测。
