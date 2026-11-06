# Changelog

## Unreleased

- 看板体验：安全 Markdown、结构化信号、原文复制、手机筛选与详情 sheet、心跳独立计数、今日发布视角；增加 published_day 查询参数及经 D005 授权的详情 data_raw 只读扩展，协议、Access 与 producer token 不变。

- 原样保存全部生产者 token 轮换提示词供后续使用，本次未执行轮换。

- Step 5.2：修复 JWKS 请求的 workerd redirect 兼容错误导致合法 Access JWT 恒定 401；保留跳转拒绝与全部验证条件，增加原生运行时和日志脱敏回归。

- 按主人裁决撤回公开服务地址，接入文档恢复占位，地址随 token 私密交付。

- 投递域拆分（step 5.1）：保留看板读取域，修复 Access 路径 Bypass 导致浏览器 GET 缺 JWT。

- 第 4 步准备：增加 GET API 的 Access JWT 第二道校验与测试、私密配置忽略规则；POST agent 鉴权不变，无新增依赖，不部署。

- 按 owner 授权增加标的只读 lots 详情，使用公开协议虚构 fixture；列表无成本、写 token 禁读、空值不猜。

- 压缩页头并使全局筛选条吸顶，保留原有筛选功能。

- 完成 390×844 逐 Tab 手机视觉检查，修复深链接选中 Tab 不可见，记录截图证据。

- 补齐 P1 查询接口、搜索分页及本地 D1 测试，记录 Moon 两项裁决（PROTOCOL.md 不变）。
- 接通只读看板及动态 agent、未查到/部分缺失/断供状态；owner 真机截图初步通过（2026-11-04），回顶位置与各 Tab 空态留待下一轮。

- 原样纳入 Agent 接入指南 docs/AGENT-ONBOARDING.md，并在 README 增加入口。

## 0.1.0

- 原样纳入已审核可公开协议 v1；建立 P0/P1 地基。未修改协议。
