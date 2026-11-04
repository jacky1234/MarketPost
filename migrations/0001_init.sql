-- 核心表：所有 AI POST 的内容
CREATE TABLE feed_items (
  id TEXT PRIMARY KEY,
  idempotency_key TEXT UNIQUE NOT NULL,
  protocol_version TEXT NOT NULL DEFAULT '1.0',
  type TEXT NOT NULL,
  from_agent TEXT NOT NULL,
  producer TEXT NOT NULL,
  market TEXT, symbol TEXT, name TEXT, tier TEXT,
  trading_day TEXT,
  event_at TEXT, published_at TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'normal',
  status TEXT NOT NULL DEFAULT 'ok',
  title TEXT NOT NULL, summary TEXT, body_md TEXT,
  data_json TEXT, signals_json TEXT, sources_json TEXT, view_json TEXT,
  reply_to TEXT REFERENCES commands(id),
  tags TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
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
  created_at TEXT, updated_at TEXT
);
CREATE TABLE watchlist_lots (
  lot_id TEXT PRIMARY KEY, symbol TEXT REFERENCES watchlist(symbol),
  shares NUMERIC, cost NUMERIC, note TEXT, alert_rule TEXT
);

-- 事件日历（监管决定、财报、读数；看板倒计时靠它）
CREATE TABLE events (
  id TEXT PRIMARY KEY, symbol TEXT, market TEXT,
  event_type TEXT NOT NULL, title TEXT NOT NULL,
  event_date TEXT NOT NULL, timezone TEXT DEFAULT 'Asia/Shanghai',
  importance TEXT DEFAULT 'normal', description TEXT, source_url TEXT,
  status TEXT DEFAULT 'upcoming'
);

-- 提醒规则（用户既定规则的登记处，触发逻辑仍在 AI 侧，表只管登记与状态）
CREATE TABLE alert_rules (
  id TEXT PRIMARY KEY, symbol TEXT NOT NULL, rule_type TEXT NOT NULL,
  rule_desc TEXT NOT NULL, condition_json TEXT,
  one_shot INTEGER DEFAULT 0, active INTEGER DEFAULT 1,
  last_triggered_at TEXT, created_at TEXT
);
-- 预置两条（示例）：123456 盘中 +2%（one_shot=0，按日重置）、示例标的加仓笔到 55（one_shot=1）

-- 指令队列（二期启用，一期建表占位）
CREATE TABLE commands (
  id TEXT PRIMARY KEY, idempotency_key TEXT UNIQUE NOT NULL,
  type TEXT NOT NULL, payload_json TEXT, status TEXT NOT NULL DEFAULT 'pending',
  requested_by TEXT, requested_at TEXT NOT NULL,
  claimed_by TEXT, claimed_at TEXT,
  completed_at TEXT, result_feed_id TEXT, error TEXT
);
