-- ============================================================
-- SkillMesh D1 迁移 0006：HTTP 类型能力种子
-- ============================================================
-- 背景：线上 21 个能力全为 mcp/prompt 类型、0 个 http，
--       导致 Try-It 无法演示 HTTP 调用链路。
-- 本迁移插入 1 条 http 类型能力锚点（http-echo-demo）。
--
-- 说明：
--   - 信任向量初始字段与 0002_seed.sql 结构保持一致；
--   - FTS 触发器 capabilities_ai 已在 0001_init.sql 定义
--     （AFTER INSERT ON capabilities），本迁移 INSERT 后
--     自动同步 capabilities_fts，无需重复建触发器；
--   - 使用 INSERT OR IGNORE 保证迁移可重入（幂等）。
-- ============================================================

INSERT OR IGNORE INTO capabilities (id, name, name_en, "desc", desc_en, input, input_en, output, output_en, endpoint, endpoint_type, category, provenance, trust_source, trust_usage, trust_usage_rate, trust_success, trust_risk, trust_time, evidence_count, evidence_uncertainty, features, features_en, usage_guide, usage_guide_en, code_example, last_updated, version)
VALUES ('http-echo-demo', 'HTTP回显调试', 'HTTP Echo Debug', '将任意 HTTP 请求原样回显（方法、请求头、请求体、来源IP），用于接口调试与连通性验证', 'Echo any HTTP request back as-is (method, headers, body, source IP) for API debugging and connectivity checks', 'HTTP 方法、URL、请求头、请求体', 'HTTP method, URL, headers, body', '回显 JSON：method、headers、body、ip、url', 'Echo JSON: method, headers, body, ip, url', 'https://httpbin.org/anything', 'http', 'dev', 'https://httpbin.org', 0.90, 3200, 0.55, 0.97, 0.08, 0.93, 3200, 0.21, '["请求回显","方法/头/体","来源IP","连通性验证"]', '["Request echo","Method/headers/body","Source IP","Connectivity check"]', '发送任意 HTTP 请求到 https://httpbin.org/anything，服务端将请求内容原样回显为 JSON。', 'Send any HTTP request to https://httpbin.org/anything; the server echoes the request as JSON.', '{"method":"GET","url":"https://httpbin.org/anything","headers":{"Accept":"application/json"}}', '2026-09-01', 1);
