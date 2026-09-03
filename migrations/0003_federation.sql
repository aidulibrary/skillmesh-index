-- ============================================
-- CCP 联邦化协议 v0.5.0
-- ============================================
-- 联邦节点注册表：存储已知的 CCP 联邦节点
-- 索引摘要缓存表：缓存从联邦节点获取的能力摘要
-- ============================================

CREATE TABLE IF NOT EXISTS federation_nodes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  description TEXT,
  public_key TEXT,
  trust_weight REAL DEFAULT 0.5,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
  capabilities_count INTEGER DEFAULT 0,
  last_seen TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS federation_index_cache (
  node_id TEXT NOT NULL,
  capability_id TEXT NOT NULL,
  name TEXT,
  name_en TEXT,
  category TEXT,
  trust_usage_rate REAL,
  trust_success REAL,
  trust_uncertainty REAL,
  cached_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (node_id, capability_id),
  FOREIGN KEY (node_id) REFERENCES federation_nodes(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_federation_nodes_status
  ON federation_nodes(status);

CREATE INDEX IF NOT EXISTS idx_federation_nodes_trust
  ON federation_nodes(trust_weight DESC);

CREATE INDEX IF NOT EXISTS idx_federation_cache_node
  ON federation_index_cache(node_id, cached_at);

CREATE INDEX IF NOT EXISTS idx_federation_cache_search
  ON federation_index_cache(category, name);