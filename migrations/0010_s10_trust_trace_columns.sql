-- ============================================
-- 阶段十（S10-9 / S10-10）字段补齐 v1.0.0
-- ============================================
-- 背景：
--   - S10-9 调用链追踪：telemetry.js 向 telemetry_records 写入
--     W3C Trace Context（trace_id），表结构需新增 trace_id 列
--   - S10-10 节点信任策略：trust-policy.js 的 PUT 需将策略持久化
--     到 federation_nodes.trust_policy（JSON 文本），表结构需新增
--     trust_policy 列
-- 说明：0008/0009 为已发布迁移不可修改，本迁移在原表上追加列，
--   与 0009 模式保持一致（ALTER TABLE ADD COLUMN）。
-- ============================================

-- 遥测流水：附加 W3C Trace Context trace_id（sourced from traceparent 头）
ALTER TABLE telemetry_records ADD COLUMN trace_id TEXT;

-- 联邦节点：附加节点级信任策略 JSON（权重/阈值/自动接受）
ALTER TABLE federation_nodes ADD COLUMN trust_policy TEXT;

CREATE INDEX IF NOT EXISTS idx_telemetry_records_trace
  ON telemetry_records(trace_id);
