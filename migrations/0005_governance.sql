-- ============================================
-- CCP 联邦治理 v1.0.0
-- ============================================
-- 治理提案表：存储协议升级提案
-- 治理投票表：存储节点投票记录
-- ============================================

CREATE TABLE IF NOT EXISTS governance_proposals (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('spec-change', 'api-change', 'policy-change', 'node-management', 'other')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'proposed', 'voting', 'accepted', 'rejected', 'implemented')),
  proposer_node_id TEXT NOT NULL,
  proposer_name TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  voting_start_at TEXT,
  voting_end_at TEXT
);

CREATE TABLE IF NOT EXISTS governance_votes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  proposal_id TEXT NOT NULL,
  node_id TEXT NOT NULL,
  node_name TEXT,
  vote TEXT NOT NULL CHECK (vote IN ('approve', 'reject', 'abstain')),
  weight REAL NOT NULL DEFAULT 1.0,
  voted_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (proposal_id) REFERENCES governance_proposals(id),
  UNIQUE(proposal_id, node_id)
);

CREATE INDEX IF NOT EXISTS idx_governance_proposals_status
  ON governance_proposals(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_governance_votes_proposal
  ON governance_votes(proposal_id);

-- ============================================
-- 扩展贡献者表：添加角色和徽章字段
-- ============================================

ALTER TABLE contributors ADD COLUMN role TEXT DEFAULT 'observer';
ALTER TABLE contributors ADD COLUMN trust_score REAL DEFAULT 0.5;
ALTER TABLE contributors ADD COLUMN badges TEXT DEFAULT '[]';
ALTER TABLE contributors ADD COLUMN node_id TEXT;