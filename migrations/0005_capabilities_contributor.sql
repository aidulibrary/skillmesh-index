-- ============================================
-- CCP v1.0.0 — capabilities 表贡献者字段
-- ============================================

ALTER TABLE capabilities ADD COLUMN contributor_login TEXT DEFAULT '';
ALTER TABLE capabilities ADD COLUMN contributor_id INTEGER DEFAULT 0;