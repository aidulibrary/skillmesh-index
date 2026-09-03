-- ============================================
-- CCP 贡献者身份锚定 v1.0.0
-- ============================================
-- 贡献者表：存储 GitHub OAuth 登录用户信息
-- 贡献记录表：关联贡献者与能力锚点
-- ============================================

CREATE TABLE IF NOT EXISTS contributors (
  github_id INTEGER PRIMARY KEY,
  github_login TEXT NOT NULL,
  github_name TEXT,
  github_avatar TEXT,
  contributions_count INTEGER DEFAULT 0,
  first_seen TEXT DEFAULT (datetime('now')),
  last_seen TEXT DEFAULT (datetime('now')),
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS contribution_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  github_id INTEGER NOT NULL,
  capability_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('create', 'update')),
  submitted_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (github_id) REFERENCES contributors(github_id),
  FOREIGN KEY (capability_id) REFERENCES capabilities(id)
);

CREATE INDEX IF NOT EXISTS idx_contributors_login
  ON contributors(github_login);

CREATE INDEX IF NOT EXISTS idx_contribution_records_cap
  ON contribution_records(capability_id, submitted_at DESC);

CREATE INDEX IF NOT EXISTS idx_contribution_records_user
  ON contribution_records(github_id, submitted_at DESC);