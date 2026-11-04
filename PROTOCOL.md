# MarketPost 盘面邮局 · 协议与界面功能 v1 草稿

> 项目名（2026-11-03 定）：**MarketPost（盘面邮局）**，GitHub 仓库名 `marketpost`，**公共仓库**（代码与协议公开，数据不进仓库，见 §7.5）
> 状态：草稿（可公开版）——本版所有标的、股数、成本、触发价、域名均为虚构示例或占位符，真实持仓与真实域名不进仓库；原版留本地。待作者审定后固化到新项目仓库根目录（建议文件名 `PROTOCOL.md`）
> 日期：2026-11-03 ｜ 定义人：作者 ｜ 生产者：Muse / Codex 等任意 AI 任务 ｜ 消费者：看板服务 + 展示前端
> 一句话：**作者 定义协议，AI 按协议 POST，服务只落库，看板只展示；数据收集与逻辑处理全部在 AI 侧。**

---

## 0. 按 作者 习惯定的硬规矩（协议层强制，不是建议）

1. **交易日必标**：任何行情类内容必须带 `trading_day`，且必须是该数字所属的交易日，不许用发布日冒充（教训：2026-10-16 晨报美股日期漂移）。美股内容还要带美东日期。
2. **没查到就明说**：查不到价格/公告时照常 POST，`status: "unretrieved"` 并注明原因。静默缺失 = 视为生产者故障，看板不许留白假装无事。
3. **无异动也要有一行**：核心持仓的盘前/盘后即使无新闻、无触发，也要 POST 一条状态行。静默不等于遗忘。
4. **可以有观点，但不下买卖指令**（2026-11-03 作者 澄清）：市场/板块层面的方向倾向、排序、判断升降档、风险排序调整都允许，如“港股可能更有机会”“互联网 > 创新药 > AI硬件”“判断由中性上调为中性偏积极”——这不算买卖建议。线划在：不对具体个股下达明确买卖指令，不给仓位和时点命令（如“今天买入 X”“卖出你的某笔持仓”）。观点必须走独立的 `view` 字段（见 §2.7），与事实分开标注，带依据与失效条件。用户自己的既定规则（如到价提醒）属于 `alert_rule`，不是建议。协议仍不设 `advice / recommendation / trade_action` 字段。
5. **信号固定三段式**：所有技术/观察信号统一为 `信号｜触发条件｜意味着什么`，见 §2.4。
6. **提醒分级、触发型才打扰**：`severity` 分四级（见 §2.2），只有 `urgent` 才允许生产者另行发聊天提醒；其余只进看板。一次性规则触发后自动失效，不重复报。
7. **时间一律带时区**：存储用 ISO 8601 带偏移（如 `2026-11-03T16:30:00+08:00`），展示统一 Asia/Shanghai，美股事件另标美东时间。
8. **涨跌颜色统一中国习惯**：全看板红涨绿跌，港股、美股也一样，不按美股绿涨红跌，避免同屏混乱。
9. **来源必附**：公告、新闻、财报类内容必须带 `sources[]`（标题+链接+发布方+发布时间），无来源不入库（服务端校验拒绝）。

---

## 1. 总体架构

```
生产者（AI 任务）                     服务（哑存储）               看板（哑展示）
─────────────────                   ─────────────              ─────────────
晨报 inbox-morning-briefing ─┐
公告监控 holdings-news-watch ─┤ POST /v1/feed   ┌──────────┐  GET /v1/feed
盘中触发 spike / trim alert  ─┼────────────────▶│ 校验协议  │──────────────▶ 按 Tab/标的渲染
盘后总结（新建任务）          ─┤                 │ 落库 DB   │  不计算、不抓价
技术面计算（新建任务）        ─┤                 │ 按标的归档 │  不写总结
周报 weekly-review           ─┘                 └──────────┘
                                                      ▲
二期反向通道：看板 POST /v1/commands（刷新/加标的/深挖）│
        AI 定时轮询 GET commands?status=pending ──────┘（类 Gmail 收件箱，执行后回 POST feed 并回填 reply_to）
```

服务端职责边界：只做 ①协议校验 ②鉴权 ③落库 ④查询接口。不抓行情、不算指标、不调 LLM。前端职责边界：只读 DB 渲染，不直接访问任何行情源。

---

## 2. 协议（Feed，下行）

### 2.1 传输约定

- 方式：`POST https://<服务地址>/v1/feed`，`Content-Type: application/json`
- 鉴权：请求头 `Authorization: Bearer <PRODUCER_TOKEN>`，**每个 agent 一个独立 token 并与 `from` 绑定**（token_muse 只能 POST `from=muse` 的内容，想冒充其他 agent 服务端直接拒绝——按 agent 筛选看观点的可信度靠它保证），可单独吊销、单独轮换；token 权限最小化：默认只有 `POST /v1/feed`，读 watchlist 另发只读 token 且不返回 lots 成本明细；token 不进代码仓库，只走环境变量
- 版本：路径带 `/v1/` + 信封内 `protocol_version: "1.0"` 双保险；不兼容变更升 v2，v1 至少保留兼容期
- 幂等：同一 `idempotency_key` 重复 POST 返回 200 且 `deduplicated: true`，不重复入库（AI 任务重试、网络重发都靠它兜底）。`idempotency_key` 必须包含 `from`——同一天、同标的、同 type，Muse 和 ChatGPT 各发一份是**两条独立内容并存**，绝不能互相去重覆盖；多 agent 同日同标的正是看板要支持对比的场景
- 响应：成功 `201 { "id": "...", "deduplicated": false }`；格式错误 `400` 并逐字段说明；鉴权失败 `401`

### 2.2 通用信封（所有类型共用）

```json
{
  "protocol_version": "1.0",
  "id": "uuid，由生产者生成",
  "idempotency_key": "from + producer + type + symbol + trading_day + subtype 的稳定拼接，如 muse:morning-briefing:post_market:09999.HK:2026-11-03",
  "type": "post_market",
  "from": "muse",
  "producer": "inbox-morning-briefing | holdings-news-watch | post-market-job | tech-job | weekly-review | manual",
  "market": "HK | US | SH | SZ | FUND | FX | GLOBAL",
  "symbol": "09999.HK",
  "name": "示例生物科技",
  "tier": "core",
  "trading_day": "2026-11-03",
  "event_at": "2026-11-03T16:00:00+08:00",
  "published_at": "2026-11-03T16:30:00+08:00",
  "severity": "normal",
  "status": "ok",
  "title": "示例生物科技 盘后总结 2026-11-03",
  "summary": "收 50.00，-2.00%，跌破 MA20，无新公告。",
  "body_md": "Markdown 正文，给人读的完整总结",
  "data": { "见 §2.3，按 type 定义": "..." },
  "signals": [ { "见 §2.4": "..." } ],
  "sources": [ { "见 §2.5": "..." } ],
  "reply_to": null,
  "tags": ["盘后", "示例管线"]
}
```

字段规则：

| 字段 | 规则 |
|---|---|
| `from` | **必填，内容来源 agent**，小写标识：`muse / chatgpt / codex / kimi / gemini / other:<name>`。它回答“这份内容是谁产出的”，与 `producer`（哪个任务/通道送来的，如 `inbox-morning-briefing`、`manual`）是两个维度，不许混用：同一任务可由不同 agent 执行，同一 agent 也可跑多个任务。缺失或乱填服务端拒绝。看板按日期+agent 筛选、只看某 agent 观点，都靠它 |
| `type` | 枚举见 §2.3，不在枚举内服务端拒绝 |
| `severity` | `info` 仅记录 / `normal` 常规 / `important` 看板标红点 / `urgent` 触发型（允许另行聊天提醒） |
| `status` | `ok` 正常 / `unretrieved` 没查到（必须在 summary 写明原因）/ `partial` 部分缺失（在 data.missing[] 列出缺什么） |
| `summary` | ≤120 字，看板列表页只显示它，必须自包含结论 |
| `reply_to` | 二期用：回应某条 command 时填该 command 的 id，一期恒为 null，但字段保留 |
| `trading_day` | 行情类必填；`announcement / event_update` 可填事件日；`system_heartbeat` 可为 null |

### 2.3 type 枚举与各自的 data 结构

| type | 生产者 | 频率 | data 关键字段 |
|---|---|---|---|
| `pre_market` | 晨报 | 每日 08:00 前 | `scope_markets[]`, `overnight_notes`, `today_events[]`（当日事件 id） |
| `post_market` | 盘后任务（新建） | 港A 16:30 / 美股次晨并入晨报 | `open, high, low, close, change_pct, volume, volume_ratio` |
| `price_snapshot` | 晨报/盘后 | 每日每标的至少 1 条 | `close, change_pct, prev_close, currency`（持仓行/基金行就靠它拼） |
| `fx_snapshot` | 晨报 | 每日 | `usd_cny_onshore, usd_cny_offshore, dxy, fx_trading_day` |
| `tech_report` | 技术面任务（新建） | 每日盘后每核心标的 1 条 | `ma{5,20,60,250}, macd{dif,dea,hist,state}, rsi14, boll{upper,mid,lower,pos}, atr14, dist_to_ma20_pct, dist_to_52w_high_pct, bars[]`（近 60 日 OHLCV，供看板画 K 线，看板不外抓） |
| `announcement` | 公告监控 | 有公告才发，无公告发 heartbeat | `ann_type`（定期报告/配售/临床/回购/其他）, `ann_title`, `pdf_url` |
| `alert_trigger` | 盘中触发任务 | 触发时 | `rule_id, rule_desc, trigger_value, threshold, one_shot: true` |
| `event_update` | 事件跟踪 | 事件有进展时 | `event_id, event_type`（earnings/pdufa/readout/dividend/other）, `event_date, countdown_days, update_note` |
| `weekly_review` | 周报 | 每周一期 | `week_start, week_end, market_recap_ref` |
| `portfolio_snapshot` | 晨报（可选） | 每日 | `lots[]` 明细见 §2.6；一期默认只含价格不算盈亏，待 作者 定是否开盈亏 |
| `system_heartbeat` | 每个生产者 | 每次运行结束 | `job, ran_at, result: ok/failed/skipped, note`（看板“数据新鲜度”靠它判断哪个任务断了） |

### 2.4 signals 固定结构

```json
"signals": [
  { "name": "跌破MA20", "condition": "close 50.00 < ma20 55.00", "meaning": "短期趋势转弱，看 MA60 支撑", "level": "warn" }
]
```

`level`：`info / warn / strong`。没有信号时发空数组，不许硬凑。

### 2.5 sources 固定结构

```json
"sources": [
  { "title": "公告原文标题", "url": "https://...", "publisher": "HKEXnews", "published_at": "2026-11-03T07:30:00+08:00" }
]
```

### 2.6 标的与持仓口径（watchlist 协议）

- `symbol` 规范：`代码.市场`，市场 ∈ `HK / US / SH / SZ`；场外基金用 `123456.FUND`，其代理标的单列 `proxy_symbol: "654321.SH"`，价格以代理为准并在展示时注明“代理”。
- `tier` 分层（决定看板待遇）：
  - `core` 核心持仓：示例标的 `09999.HK`、ABCD `ABCD.US`、EFGH `EFGH.US` —— 盘前盘后必报、技术面全量、公告监控
  - `rule` 规则持仓：`123456.FUND` —— 只报触发线相关：盘中涨幅、距 +2% 距离
  - `etf_basket` ETF 篮子：500001.SH、500002.SH、500003.SH、500004.SH、500005.SH、500006.SH —— 只进周度汇总，日级只落 price_snapshot
  - `record_only` 仅记录：示例材料公司 `699999.SH` —— 只落档案与价格，不进日报、不提醒
  - `watch` 纯观察：无持仓，只报价格+事件
- 持仓分笔 `lots[]`（示例标的是典型：底仓与加仓笔规则不同，必须拆开）：
  ```json
  { "lot_id": "demo-base", "shares": 500, "cost": 50.0, "note": "底仓，不动" }
  { "lot_id": "demo-topup-20260101", "shares": 200, "cost": 42.0, "note": "加仓笔", "alert_rule": "到 55 提醒卖出，一次性" }
  ```
  股数/成本为可选字段，未给成本的标的留空，看板显示“未录入”，不许猜。

### 2.7 view 观点结构（可选，但出现时必须长这样）

观点不许散落在正文里冒充事实，必须收进独立字段，看板单独成区展示、和事实区视觉分开：

```json
"view": {
  "scope": "market | sector | symbol",
  "target": "港股成长 / 恒生科技",
  "stance": "cautiously_positive",
  "stance_delta": "由 neutral 上调一档",
  "horizon": "short",
  "confidence": "medium",
  "basis": ["10Y 一个月回落约 43bp", "恒科在南向净卖出下仍 +2.25%，相对强度好"],
  "invalidation": "10Y 重新站上 4.9% 且恒科跑输恒指，观点撤回",
  "scenarios": [
    { "if": "示例标的收盘站回 80", "then": "假跌破成立，短线止跌概率上调" },
    { "if": "48 再破且 ABCD 破 30", "then": "关键事件前降风险未结束，保持谨慎" }
  ],
  "ranking": ["互联网", "创新药", "AI硬件"]
}
```

规则：`stance` 枚举 `bearish / cautious / neutral / cautiously_positive / positive`；板块排序走 `ranking`；个股层面只许到“谨慎/积极观察/止跌概率上调”这一级表述 + 情景条件，不许出现买卖动词+具体个股+时点的指令句。每条 view 必带 `basis`（回指事实）和 `invalidation`（什么情况观点作废），无依据的观点服务端应打回 `partial` 并标注。

---

## 3. 反向协议（Commands，上行，二期但一期定死格式）

看板不直接执行任何动作，只往指令队列里投一条：

```json
POST /v1/commands
{
  "protocol_version": "1.0",
  "idempotency_key": "board:refresh:09999.HK:2026-11-03T21:05:00+08:00",
  "type": "refresh | deep_dive | run_tech | add_symbol | remove_symbol | set_alert | ack_alert",
  "payload": { "symbol": "09999.HK", "scope": "post_market+tech" },
  "requested_by": "board-ui",
  "requested_at": "2026-11-03T21:05:00+08:00"
}
```

状态机：`pending → claimed → done / failed`（带 `claimed_by, completed_at, error, result_feed_id`）。
AI 侧轮询节奏复用现有习惯：像 `inbox-triage-scan` 扫 Gmail 一样定时扫队列（如每 30 分钟，盘中指令可加密到 15 分钟）；认领后执行，结果以普通 feed POST 回来并填 `reply_to = command.id`，看板据此把按钮从“等待 AI 处理”变成“已更新 + 时间”。

---

## 4. 数据库设计（结构化落库，SQLite 起步，schema 兼容 Postgres）

设计原则：**高频筛选的字段拆成列，扩展内容放 JSON 列**。不全塞 JSON（没法按标的/日期查），也不全拆表（协议一升级就要改表）。

```sql
-- 核心表：所有 AI POST 的内容
CREATE TABLE feed_items (
  id TEXT PRIMARY KEY,
  idempotency_key TEXT UNIQUE NOT NULL,
  protocol_version TEXT NOT NULL DEFAULT '1.0',
  type TEXT NOT NULL,
  from_agent TEXT NOT NULL,
  producer TEXT NOT NULL,
  market TEXT, symbol TEXT, name TEXT, tier TEXT,
  trading_day DATE,
  event_at TIMESTAMPTZ, published_at TIMESTAMPTZ NOT NULL,
  severity TEXT NOT NULL DEFAULT 'normal',
  status TEXT NOT NULL DEFAULT 'ok',
  title TEXT NOT NULL, summary TEXT, body_md TEXT,
  data_json JSONB, signals_json JSONB, sources_json JSONB, view_json JSONB,
  reply_to TEXT REFERENCES commands(id),
  tags TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_feed_symbol_day ON feed_items(symbol, trading_day DESC);
CREATE INDEX idx_feed_from_day   ON feed_items(from_agent, trading_day DESC);
CREATE INDEX idx_feed_type_day   ON feed_items(type, trading_day DESC);
CREATE INDEX idx_feed_pub       ON feed_items(published_at DESC);

-- 关注池（单一事实源，AI 每次运行前先 GET 它，不许把标的列表写死在提示词里）
CREATE TABLE watchlist (
  symbol TEXT PRIMARY KEY, market TEXT NOT NULL, name TEXT NOT NULL,
  tier TEXT NOT NULL, currency TEXT, proxy_symbol TEXT,
  thesis TEXT,             -- 关联逻辑，如“示例：两标的同时属于一条管线”
  active INTEGER NOT NULL DEFAULT 1, sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ
);
CREATE TABLE watchlist_lots (
  lot_id TEXT PRIMARY KEY, symbol TEXT REFERENCES watchlist(symbol),
  shares NUMERIC, cost NUMERIC, note TEXT, alert_rule TEXT
);

-- 事件日历（监管决定、财报、读数；看板倒计时靠它）
CREATE TABLE events (
  id TEXT PRIMARY KEY, symbol TEXT, market TEXT,
  event_type TEXT NOT NULL, title TEXT NOT NULL,
  event_date DATE NOT NULL, timezone TEXT DEFAULT 'Asia/Shanghai',
  importance TEXT DEFAULT 'normal', description TEXT, source_url TEXT,
  status TEXT DEFAULT 'upcoming'
);

-- 提醒规则（用户既定规则的登记处，触发逻辑仍在 AI 侧，表只管登记与状态）
CREATE TABLE alert_rules (
  id TEXT PRIMARY KEY, symbol TEXT NOT NULL, rule_type TEXT NOT NULL,
  rule_desc TEXT NOT NULL, condition_json JSONB,
  one_shot INTEGER DEFAULT 0, active INTEGER DEFAULT 1,
  last_triggered_at TIMESTAMPTZ, created_at TIMESTAMPTZ
);
-- 预置两条（示例）：123456 盘中 +2%（one_shot=0，按日重置）、示例标的加仓笔到 55（one_shot=1）

-- 指令队列（二期启用，一期建表占位）
CREATE TABLE commands (
  id TEXT PRIMARY KEY, idempotency_key TEXT UNIQUE NOT NULL,
  type TEXT NOT NULL, payload_json JSONB, status TEXT NOT NULL DEFAULT 'pending',
  requested_by TEXT, requested_at TIMESTAMPTZ NOT NULL,
  claimed_by TEXT, claimed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ, result_feed_id TEXT, error TEXT
);
```

---

## 5. API 清单（服务对外只提供这些）

| 方法与路径 | 用途 | 阶段 |
|---|---|---|
| `POST /v1/feed` | AI 投递内容（Bearer token） | P1 |
| `GET /v1/feed?from=&type=&symbol=&trading_day=&q=&limit=&cursor=` | 看板时间流/搜索查询，`from` 按来源 agent 筛 | P1 |
| `GET /v1/agents` | 当天/历史出现过的 agent 列表及各自条数（看板 agent 选择器的数据源，不写死） | P1 |
| `GET /v1/feed/{id}` | 单条详情 | P1 |
| `GET /v1/watchlist` / `POST` / `PATCH /{symbol}` / `DELETE /{symbol}`（软删 active=0） | 关注池读写；AI 运行前读，界面改 | P1 读 / P2 写 |
| `GET /v1/events?from=&to=` | 事件日历 | P1 |
| `GET /v1/alert-rules` | 规则列表与状态 | P1 |
| `GET /v1/health/producers` | 各生产者最后一次 heartbeat，新鲜度面板 | P1 |
| `POST /v1/commands` / `GET /v1/commands?status=pending` / `PATCH /v1/commands/{id}` | 指令队列（投递/轮询认领/回填） | P2 |

---

## 6. 看板界面功能

### 6.1 全局规范（沿用 作者 既有构建标准）

- 顶部**可左右滑动 Tab**，带数量徽标；右下角 **Floating Button 一键回顶**（滚动一屏后出现）——2026-10-26 定的信息类构建统一标准
- 全局搜索：跨全部 feed 按标的名/代码/关键词搜
- **全局筛选条（所有 Tab 共用，置于 Tab 下方）**：①日期选择器（默认今天，可回翻任意一天/日期范围）②**来源 agent 选择器**：`全部 / Muse / ChatGPT / …`，选项由 `GET /v1/agents` 动态生成（以后接入新 agent 自动出现，不改前端），每项带当日条数徽标。选定后所有 Tab 只显示该 agent 在该日的内容——典型用法：选某天 → 只看 Muse 的观点。选择状态记在 URL 参数里（`?day=2026-11-03&from=muse`），可分享、可回退
- 每条内容卡片左上角固定显示来源徽标（agent 名 + producer 任务名），多 agent 同日同标的并排出现时一眼分得清是谁的；观点区（`view`）徽标跟随其所属条目，不串家
- 每页顶部有**新鲜度条**：各市场今日是否已收到盘前/盘后、最后 POST 时间、哪个生产者断了（heartbeat 超时标灰），对齐“静默不等于遗忘”
- 手机优先：卡片流不用宽表；数字等宽字体；所有价格旁必带交易日小字
- 看板只读 DB，页面刷新 ≠ 抓新数据；刷新按钮（二期）实际是投递 command，按钮旁注明“AI 处理后更新”

### 6.2 Tab 结构（7 个）

1. **总览**（默认页）：日期+三市场开/休市状态 → 今日盘前卡 → 持仓快报表（核心层，昨收/涨跌/距目标线）→ 基金一行（123456 代理价+距 +2% 距离）→ 汇率一行 → 今日/本周事件倒计时 → 最新触发提醒 → 昨日盘后摘要入口
2. **时间流**：全部 feed 按时间倒序，左筛 type，顶部筛市场/标的，并继承全局筛选条的日期+agent；`urgent` 置顶标红，`unretrieved` 显示原因不隐藏。当同一标的同一天有 ≥2 个 agent 的 `view` 时，详情页提供**观点对照**：两家的 stance / ranking / invalidation 并排展示（先只展示、不做自动裁决谁对）
3. **持仓**：按 tier 分组卡片（核心/规则/ETF篮子/仅记录/观察），点进标的详情页：价格走势（用 tech_report 的 bars 画简 K 线+MA20/60）、分笔 lots、该标的全部 feed 时间线、技术面板、关联事件、专属规则
4. **技术面**：信号总表——每标的一行：趋势（价 vs MA20/60）、MACD 状态、RSI 分区、量比、最新信号三段式；只显示 `tech_report` 已 POST 的结果，不现场计算
5. **事件**：日历列表按日期排，监管决定/财报/读数分色，显示倒计时天数，点开看历次 `event_update`
6. **提醒**：规则列表（条件、一次性/每日、启用状态、最近触发）+ 触发历史（`alert_trigger` 流水）；一期只读，二期可在此设规则（实际投递 command）
7. **指令**（二期）：投递刷新/深挖/加标的，队列状态 pending/done/failed 实时可见；一期此 Tab 显示“未启用”占位，不删

设置入口（不占 Tab）：关注池管理——加/删标的、改 tier、录入/修改 lots；一期走改 DB/配置文件，二期走 command 队列由 AI 确认落库。

### 6.3 空态与异常态（必须做，不许白屏）

- 某标的今日尚无盘后 → 卡片显示“待 AI POST（预计 16:30）”，不显示旧数据冒充今日
- 数据过期（heartbeat 断供）→ 对应卡片置灰并标“生产者未运行”，与“无异动”是两种状态要分清
- `status=partial` → 卡片角标注明缺哪项

---

## 7. 现有任务 → 协议映射（生产者改造清单）

| 现有任务 | 改法 | POST 的 type |
|---|---|---|
| `inbox-morning-briefing` 08:00 | 聊天晨报照发，额外按标的拆条 POST | `pre_market` + 每标的 `price_snapshot` + `fx_snapshot` + `system_heartbeat` |
| `holdings-news-watch` | 有公告逐条发，无公告只发 heartbeat | `announcement` / `system_heartbeat` |
| `fund-spike-alert` | 触发逻辑不变，触发时多 POST 一条 | `alert_trigger`（severity=urgent） |
| `trim-alert` | 同上，触发后 alert_rules 置 inactive | `alert_trigger`（one_shot） |
| 每周财经汇总 | 周报照常，另发一条归档 | `weekly_review` |
| 新建：盘后任务 16:30 | 港A收盘后跑，逐核心标的发 | `post_market` + `tech_report` |
| `dashboard-refresh` / 既有聚合工作台 | 财经板块逐步改读本服务数据，最终下线静态刷新 | — |

---

## 7.5 访问鉴权与隐私隔离（2026-11-03 作者 追加要求）

背景：作者 的 VPS IP 可关联到个人信息，且看板内容含持仓等敏感财务数据。原则：**任何 agent、任何访问者，都不应从看板服务反推出 VPS 真实 IP 与 作者 的个人身份关联。**

三层鉴权，互不替代：

1. **看板登录（人 → 看板）**：必须登录。首选 Cloudflare Access（邮箱一次性验证码）挡在站点前面，应用层不自建密码系统（少存一份密码哈希、少一个攻击面）；备选为应用自带单用户登录（密码 Argon2 哈希 + httpOnly/Secure/SameSite 会话 Cookie + 登录限流，无注册入口）。注意配置细节：Access 只挡人读的页面与 GET 接口，`POST /v1/feed` 路径必须对 Access 放行（Bypass），改由第 2 层的 agent token 把关，否则 agent 会被登录页挡住投递失败。
   仓库可公开与数据私有的分界：**代码/协议/假数据进公共仓库，真实数据只在 D1 里**——真实 watchlist 与 lots（持仓股数/成本）不写进仓库的 seed、fixture、测试、截图和 README，部署后经授权接口/后台单独灌入；持仓只有投递的 agent 知道、看板侧登录后才可见。仓库开 GitHub secret scanning + push protection，token、Cloudflare 凭证一律走 Secrets/环境变量，`.env` 进 `.gitignore`。
2. **生产者投递（agent → 服务）**：Bearer token 按 agent 分发并绑 `from`（见 §2.1），默认仅 `POST /v1/feed`，**无权 GET feed / watchlist**——后接入的 agent（尤其国产模型）只能写自己那一份，看不到他人观点与持仓明细；需要关注池上下文时由 作者 在其会话里给，不走 API 读。token 可单独吊销。
3. **指令与管理（人 → commands / watchlist 写接口）**：必须走第 1 层登录态，agent token 一律无权。

隐藏源站与去关联，按强度三选一，**首选方案 A**：

- **方案 A（推荐）：服务根本不放这台 VPS**——跑在 Cloudflare Workers + D1（SQLite 兼容，正好套用 §4 表结构）上，没有源站 IP 这个东西，agent 只接触 Cloudflare 边缘地址；免费额度对本看板的量级绰绰有余。VPS 与看板零关联，代理服务/博客等既有服务不受影响。
- **方案 B：VPS + Cloudflare Tunnel**——`cloudflared` 只出站建隧道，DNS 里不出现源站 IP、VPS 不开任何入站端口；配合防火墙全关入站。弱点：同机其他服务若有直连记录，仍可能侧面暴露该 IP。
- **方案 C（最弱，不推荐单独用）：VPS + Cloudflare 橙云代理**——DNS 只见 CF 地址，但历史 DNS 记录、未代理的子域名、配置失误都可能漏出源站 IP。

去关联附带要求（任一方案都适用）：
- ~~看板用独立域名，不用 `<你的域名>` 子域名~~（2026-11-03 晚 作者 拍板**不执行此条**：经评估关联路径虽存在但其所做之事合理合法、父域名关联本已暴露，为此另买域名不值当；看板直接用 `<你的域名>` 子域名，如 `board.<你的域名>`。残余要求不变：子域名走方案 A/B 时源站 IP 仍不出现，仓库里不写敏感信息）
- 协议负载里不出现真实姓名、邮箱等身份字段；生产者身份只有 `from` 标识
- 服务端日志不记录、更不回显源站信息；给 agent 的只有看板/API 的公开（经 CF 的）地址与它自己的 token

---

## 8. 渐进实现与验收

- **P0 协议固化**：本文件审定 → 入新项目仓库；同时定服务地址与 token 发放方式
- **P1 单向跑通**：服务（feed 落库+查询 API+watchlist/events/alert_rules 表）+ 看板 6 个 Tab 只读展示；验收：用真实晨报数据手工 POST 3 天，看板按标的/日期查得到、`unretrieved` 与断供状态显示正确
- **P2 生产者接入**：现有 5 个任务按 §7 改造，连续跑一周无重复入库（幂等生效）；盘后+技术面新任务上线
- **P3 指令队列**：commands 表启用，看板刷新/加标的走队列，AI 轮询执行并回填 `reply_to`
- **P4（可选）**：盈亏计算开关、周报回测对照（如 HARMONi-3 读数落地后与先验数字自动比对）

## 9. 待 作者 拍板（不阻塞 P0/P1，按默认值先行）

1. 美股盘前是否独立一份（默认：不独立，并入次晨晨报）
2. 是否开启精确盈亏（默认：关，只看价格；EFGH 等未给成本的标的无法算）
3. 服务部署位置（2026-11-03 定：Cloudflare Workers + D1，域名直接用 `<你的域名>` 子域名如 `board.<你的域名>`，不另购域名；服务不落现有 VPS，VPS 只需保住其既有 代理服务 用途与安全；若改主意用 VPS 托管，则必须走 Tunnel 方案 B）
4. 项目仓库名与技术栈（默认建议：Python FastAPI + SQLite + 单页前端，Codex 可替换但协议不变）
