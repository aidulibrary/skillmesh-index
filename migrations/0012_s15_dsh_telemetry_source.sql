-- ============================================================
-- S15 DSH 遥测闭环 — telemetry_records 新增 source 列
-- 目的：追踪遥测来源（direct=Agent 直传 / dsh=DSH 插件回传），
--       实现 DSH→CCP 运行时遥测闭环，让 evidence.count 动态更新。
-- 版本：v1.0.0
-- 日期：2026-09-17
-- ============================================================

-- 1. 新增 source 列（direct 或 dsh）
ALTER TABLE telemetry_records ADD COLUMN source TEXT DEFAULT 'direct';

-- 2. 新增 dsh_plugin_id 列（DSH 插件标识，非 DSH 来源为 NULL）
ALTER TABLE telemetry_records ADD COLUMN dsh_plugin_id TEXT;

-- 3. 索引：按来源 + 时间查询（遥测面板使用）
CREATE INDEX IF NOT EXISTS idx_telemetry_records_source
  ON telemetry_records(source, created_at DESC);