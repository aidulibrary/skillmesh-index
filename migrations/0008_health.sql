-- ============================================
-- CCP 健康面板支撑 v1.0.0
-- ============================================
-- 背景：阶段八健康面板（health.js handler）引用的部分表/列
--   在迁移体系中未定义，导致 /api/ccp/v1/health 系列端点 500。
--   本迁移补齐 schema，使健康面板可真实反映线上状态。
--   - federation_nodes 扩展（面板展示字段）
--   - federation_exchanges：节点交换流水（预留）
--   - telemetry_records：遥测事件流水（预留）
-- ============================================

-- federation_nodes 扩展列（health.js 面板读取）
ALTER TABLE federation_nodes ADD COLUMN trust_score REAL DEFAULT 0.5;
ALTER TABLE federation_nodes ADD COLUMN last_exchange TEXT;
ALTER TABLE federation_nodes ADD COLUMN exchange_frequency TEXT DEFAULT 'manual';
ALTER TABLE federation_nodes ADD COLUMN is_active INTEGER DEFAULT 1;
ALTER TABLE federation_nodes ADD COLUMN added_at TEXT;

-- 回填扩展列：trust_score <- trust_weight；last_exchange <- last_seen
UPDATE federation_nodes
SET trust_score = COALESCE(trust_score, trust_weight, 0.5),
    last_exchange = COALESCE(last_exchange, last_seen),
    added_at = COALESCE(added_at, created_at)
WHERE trust_score IS NULL OR last_exchange IS NULL OR added_at IS NULL;

-- 交换流水表（federation/exchange 未来事件化接入；health.js 节点详情引用）
CREATE TABLE IF NOT EXISTS federation_exchanges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  node_id TEXT NOT NULL,
  capability_id TEXT,
  direction TEXT DEFAULT 'inbound' CHECK (direction IN ('inbound', 'outbound')),
  exchanged_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (node_id) REFERENCES federation_nodes(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_federation_exchanges_node
  ON federation_exchanges(node_id, exchanged_at DESC);

-- 遥测事件流水表（telemetry 回传可落明细；health.js 统计引用）
CREATE TABLE IF NOT EXISTS telemetry_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  capability_id TEXT NOT NULL,
  event_type TEXT NOT NULL DEFAULT 'usage',
  node_id TEXT,
  payload TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_telemetry_records_time
  ON telemetry_records(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_telemetry_records_type
  ON telemetry_records(event_type);
