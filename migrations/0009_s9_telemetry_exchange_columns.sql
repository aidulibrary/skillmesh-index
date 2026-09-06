-- ============================================
-- 阶段九（S9-3 健康面板数据写入）字段补齐 v1.0.0
-- ============================================
-- 背景：0008_health.sql 中 federation_exchanges / telemetry_records 为
--   "预留"流水表，仅含基础列；S9-3 数据写入需补充事件明细列：
--   - telemetry_records：记录 agent_id / success / latency_ms
--   - federation_exchanges：记录 capabilities_count / status
-- 说明：0008 为已发布迁移不可修改，本迁移在原表上追加列，保证
--   telemetry.js / exchange.js 的 INSERT 语义可真实落库。
-- ============================================

-- 遥测事件流水：补充调用方标识与结果明细
ALTER TABLE telemetry_records ADD COLUMN agent_id TEXT DEFAULT 'unknown';
ALTER TABLE telemetry_records ADD COLUMN success INTEGER DEFAULT 1;
ALTER TABLE telemetry_records ADD COLUMN latency_ms INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_telemetry_records_agent
  ON telemetry_records(agent_id, created_at DESC);

-- 联邦交换流水：补充交换规模与结果状态
ALTER TABLE federation_exchanges ADD COLUMN capabilities_count INTEGER DEFAULT 0;
ALTER TABLE federation_exchanges ADD COLUMN status TEXT DEFAULT 'pending';
