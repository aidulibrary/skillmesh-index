-- ============================================================
-- S16 静态数据统一 — 补入 http-ip-geo-021
-- 目的：js/data.js 与 functions/_data/capabilities.js 对齐（21→21），
--       并将缺失的能力锚点同步至 D1 数据库。
-- 版本：v1.0.0
-- 日期：2026-09-18
-- ============================================================

INSERT OR REPLACE INTO capabilities (
  id, name, name_en, "desc", desc_en, input, input_en, output, output_en,
  endpoint, endpoint_type, category, provenance,
  trust_source, trust_usage, trust_usage_rate, trust_success, trust_risk, trust_time,
  evidence_count, evidence_uncertainty,
  features, features_en, usage_guide, usage_guide_en, code_example,
  contributor_login, contributor_id,
  last_updated, version
) VALUES (
  'http-ip-geo-021',
  'IP地理位置查询',
  'IP Geolocation Lookup',
  '通过REST API查询任意IP地址的地理位置信息（国家、城市、ISP）',
  'Query geolocation info (country, city, ISP) for any IP via REST API',
  'IP地址（可选，默认为请求方IP）',
  'IP address (optional, defaults to requester IP)',
  '国家、城市、ISP、经纬度、时区',
  'Country, city, ISP, coordinates, timezone',
  'https://ipapi.co/json/?ip={ip}',
  'http',
  'data',
  'https://github.com/ipapi-co/ipapi',
  0.94,
  9500,
  0.98,
  0.98,
  0.05,
  0.95,
  9500,
  0.2,
  '["REST API","高可用","无需认证","速率限制友好"]',
  '["REST API","High availability","No auth required","Rate-limit friendly"]',
  '发送GET请求到 https://ipapi.co/json/ 即可获取当前IP的地理位置信息，支持自定义IP参数。',
  'Send GET to https://ipapi.co/json/ to get geolocation info. Supports custom IP parameter.',
  '{ "method": "GET", "url": "https://ipapi.co/json/", "headers": { "Accept": "application/json" } }',
  'seed-importer',
  0,
  '2026-09-18',
  1
);