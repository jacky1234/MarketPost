任务：轮换 MarketPost 全部 5 枚 producer token（muse/chatgpt/codex/kimi/gemini），生成新值、部署到线上、验证生效，明文只落主人本地，全程不回显。

1. 生成：openssl rand -hex 32 生成 5 枚新 token，写入新文件 .launch-private/producer-tokens.json（先写临时文件再 mv 覆盖，chmod 600）。禁止把任何明文打印到输出、日志、shell 历史。
2. 部署：逐枚用 wrangler secret put PRODUCER_TOKEN_<NAME> 更新线上 secret，值通过 stdin/文件传入，禁止拼命令行参数。其他配置（Access、AUD、团队域、已有数据）一律不动，无需改代码。
3. 验证（每枚各两枪，只报状态码）：用新 token 按 PROTOCOL 发一条 system_heartbeat（tags 含 rotation），期望 201；再用该 agent 的旧 token 发同样请求，期望 401——证明旧值已死、新值生效。五枚全过才算轮换完成。
4. 交付报告只写：每枚的掩码（前4后4）、两枪状态码、本地文件路径与权限、完成时间。不贴任何完整值。
5. 收尾：旧 token 文件如有备份（.bak 等）一并删除并在报告中注明；docs/DELIVERY.md 追加一条轮换记录（只写日期和“5 枚已轮换”，不写任何值），一笔提交 push。
6. 提醒主人（写进报告）：轮换即刻起五个生产者手里的旧 token 全部失效，需逐个私密分发新值后才能恢复投递；仅单枚泄露时不要用本流程，只轮换那一枚。
