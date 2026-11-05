# Changelog

## Unreleased

- Step 5.1：将生产者投递入口拆为独立子域名，保留看板读取域，修复 Access 路径 Bypass 导致浏览器 GET 缺 JWT；更新接入指南与地址说明。

- 第 4 步准备：增加 GET API 的 Access JWT 第二道校验与测试、私密配置忽略规则；POST agent 鉴权不变，无新增依赖，不部署。

- 按 owner 授权增加标的只读 lots 详情，使用公开协议虚构 fixture；列表无成本、写 token 禁读、空值不猜。

- 压缩页头并使全局筛选条吸顶，保留原有筛选功能。

- 完成 390×844 逐 Tab 手机视觉检查，修复深链接选中 Tab 不可见，记录截图证据。

- 补齐 P1 查询接口、搜索分页及本地 D1 测试，记录 Moon 两项裁决（PROTOCOL.md 不变）。
- 接通只读看板及动态 agent、未查到/部分缺失/断供状态；owner 真机截图初步通过（2026-11-04），回顶位置与各 Tab 空态留待下一轮。

- 原样纳入 Agent 接入指南 docs/AGENT-ONBOARDING.md，并在 README 增加入口。

## 0.1.0

- 原样纳入已审核可公开协议 v1；建立 P0/P1 地基。未修改协议。
