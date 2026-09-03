-- ============================================================
-- SkillMesh D1 数据库初始化
-- 迁移 0001：创建能力锚点表 + FTS5 全文搜索 + 版本管理
-- ============================================================

-- 能力锚点主表
CREATE TABLE IF NOT EXISTS capabilities (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  name_en TEXT NOT NULL DEFAULT '',
  "desc" TEXT NOT NULL DEFAULT '',
  desc_en TEXT NOT NULL DEFAULT '',
  input TEXT NOT NULL DEFAULT '',
  input_en TEXT NOT NULL DEFAULT '',
  output TEXT NOT NULL DEFAULT '',
  output_en TEXT NOT NULL DEFAULT '',
  endpoint TEXT NOT NULL DEFAULT '',
  endpoint_type TEXT NOT NULL DEFAULT 'mcp',
  category TEXT NOT NULL DEFAULT 'data',
  provenance TEXT NOT NULL DEFAULT '',
  trust_source REAL NOT NULL DEFAULT 0.5,
  trust_usage INTEGER NOT NULL DEFAULT 0,
  trust_usage_rate REAL NOT NULL DEFAULT 0.0,
  trust_success REAL NOT NULL DEFAULT 0.5,
  trust_risk REAL NOT NULL DEFAULT 0.5,
  trust_time REAL NOT NULL DEFAULT 0.5,
  evidence_count INTEGER NOT NULL DEFAULT 0,
  evidence_uncertainty REAL NOT NULL DEFAULT 0.5,
  features TEXT NOT NULL DEFAULT '[]',
  features_en TEXT NOT NULL DEFAULT '[]',
  usage_guide TEXT NOT NULL DEFAULT '',
  usage_guide_en TEXT NOT NULL DEFAULT '',
  code_example TEXT NOT NULL DEFAULT '',
  last_updated TEXT NOT NULL DEFAULT '',
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 全文搜索虚拟表
CREATE VIRTUAL TABLE IF NOT EXISTS capabilities_fts USING fts5(
  name,
  name_en,
  "desc",
  desc_en,
  features,
  features_en,
  category,
  content='capabilities',
  content_rowid='rowid'
);

-- 触发器：保持 FTS 索引与主表同步
CREATE TRIGGER IF NOT EXISTS capabilities_ai AFTER INSERT ON capabilities BEGIN
  INSERT INTO capabilities_fts(rowid, name, name_en, "desc", desc_en, features, features_en, category)
  VALUES (new.rowid, new.name, new.name_en, new."desc", new.desc_en, new.features, new.features_en, new.category);
END;

CREATE TRIGGER IF NOT EXISTS capabilities_ad AFTER DELETE ON capabilities BEGIN
  INSERT INTO capabilities_fts(capabilities_fts, rowid, name, name_en, "desc", desc_en, features, features_en, category)
  VALUES ('delete', old.rowid, old.name, old.name_en, old."desc", old.desc_en, old.features, old.features_en, old.category);
END;

CREATE TRIGGER IF NOT EXISTS capabilities_au AFTER UPDATE ON capabilities BEGIN
  INSERT INTO capabilities_fts(capabilities_fts, rowid, name, name_en, "desc", desc_en, features, features_en, category)
  VALUES ('delete', old.rowid, old.name, old.name_en, old."desc", old.desc_en, old.features, old.features_en, old.category);
  INSERT INTO capabilities_fts(rowid, name, name_en, "desc", desc_en, features, features_en, category)
  VALUES (new.rowid, new.name, new.name_en, new."desc", new.desc_en, new.features, new.features_en, new.category);
END;

-- 版本历史表
CREATE TABLE IF NOT EXISTS capability_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cap_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  changes TEXT NOT NULL DEFAULT '',
  data_snapshot TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (cap_id) REFERENCES capabilities(id)
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_capabilities_category ON capabilities(category);
CREATE INDEX IF NOT EXISTS idx_capabilities_endpoint_type ON capabilities(endpoint_type);
CREATE INDEX IF NOT EXISTS idx_capabilities_updated ON capabilities(updated_at);
CREATE INDEX IF NOT EXISTS idx_versions_cap_id ON capability_versions(cap_id, version);