# 实现裁决（待统一纳入 PROTOCOL v1.1）

本文件记录作者在 Moon 审核 head 497b7fa 后确认的裁决；PROTOCOL.md 保持原样。本次裁决按作者直接指示执行，不触发 AGENTS.md 的协议修改流程。

## D001 — 读权限三档

- 人/看板：通过 Cloudflare Access 全读。
- agent 写 token：默认只写，不读 feed 或 watchlist。
- watchlist 基础 reader token：独立于写 token，按 agent 单独授予；只返回 symbol/name/tier/proxy，不包含 lots 或 feed。
- 当前保持拒绝带 Authorization 的 API 读请求；reader token 排到 P2。Access 和 token 的线上配置待单独确认。

## D002 — 不完整 view

缺 basis 或 invalidation 时，HTTP 400，错误码 view_incomplete，不入库。生产者使用相同 idempotency_key 补全重发，不消耗幂等键。

partial 只能由生产者声明行情数据缺失，服务端不得降级生成或改变生产者 status。

## 本次实现约定（非协议升级）

- feed 默认每页 30，limit 为 1–100 整数；cursor 为与筛选条件绑定的不透明分页位置。按实际 published_at 时间倒序、id 倒序稳定翻页，跨时区不按字符串排序；不提供快照隔离。
- q 搜索 name/symbol/title/summary/body_md，字面子串，不把 % 或 _ 当 SQL 通配符。
- events 的 from/to 为事件日期闭区间；可缺省。共享日历/关注池/规则无 agent 字段，界面明确标为共享档案；agent 产出的 feed 与 heartbeat 按来源筛选，不伪造共享档案来源。
- 新鲜度仅基于已登记 feed 的 producer 与最后 heartbeat；未知/从未投递的任务无法推断。默认 heartbeat 超时 86400 秒，可用非敏感环境配置 HEARTBEAT_MAX_AGE_SECONDS 调整；这是运行状态判断，不是交易逻辑。历史日期以该日上海结束时刻为参照，今天以当前时间为参照。
- 不新增金融计算、抓价或内容生成。无服务端 lots 查询端点；持仓仅展示关注池与生产者已经投递的快照，分笔成本暂不展示。
