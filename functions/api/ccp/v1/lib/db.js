/**
 * D1 数据库查询封装
 * ===================
 * CCP 协议 D1 数据访问层。
 *
 * 提供统一的能力锚点查询接口，支持：
 * - 全量列表查询
 * - 单条详情查询
 * - FTS5 全文搜索 + LIKE 回退
 * - 行映射（D1 扁平行 → 能力锚点对象）
 *
 * 版本：v1.0
 * 协议：CCP v1.0.0
 */

import { CAPABILITIES } from "../../../../_data/capabilities";

/**
 * 将 D1 扁平行映射为能力锚点对象
 *
 * @param {object} row - D1 查询返回的原始行
 * @returns {object} 结构化能力锚点对象
 */
export function mapRow(row) {
  let features = [];
  let featuresEn = [];
  try {
    features = JSON.parse(row.features || "[]");
  } catch (_) {}
  try {
    featuresEn = JSON.parse(row.features_en || "[]");
  } catch (_) {}

  return {
    id: row.id,
    name: row.name,
    name_en: row.name_en,
    desc: row.desc,
    desc_en: row.desc_en,
    input: row.input,
    input_en: row.input_en,
    output: row.output,
    output_en: row.output_en,
    endpoint: row.endpoint,
    endpointType: row.endpoint_type,
    category: row.category,
    provenance: row.provenance,
    trustSource: row.trust_source,
    trustUsage: row.trust_usage,
    trustUsageRate: row.trust_usage_rate,
    trustSuccess: row.trust_success,
    trustRisk: row.trust_risk,
    trustTime: row.trust_time,
    lastUpdated: row.last_updated,
    evidence: {
      count: row.evidence_count,
      uncertainty: row.evidence_uncertainty,
    },
    features,
    features_en: featuresEn,
    usageGuide: row.usage_guide,
    usageGuide_en: row.usage_guide_en,
    codeExample: row.code_example,
    version: row.version,
  };
}

/**
 * 查询全部能力锚点（按更新时间降序）
 *
 * @param {D1Database} db - D1 数据库实例
 * @returns {Promise<Array>} 能力锚点数组
 */
export async function queryAll(db) {
  const { results } = await db
    .prepare("SELECT * FROM capabilities ORDER BY updated_at DESC")
    .all();
  return results.map(mapRow);
}

/**
 * 查询单个能力锚点
 *
 * @param {D1Database} db - D1 数据库实例
 * @param {string} id - 能力锚点 ID
 * @returns {Promise<object|null>} 能力锚点对象或 null
 */
export async function queryOne(db, id) {
  const { results } = await db
    .prepare("SELECT * FROM capabilities WHERE id = ?")
    .bind(id)
    .all();
  return results.length > 0 ? mapRow(results[0]) : null;
}

/**
 * FTS5 全文搜索
 *
 * @param {D1Database} db - D1 数据库实例
 * @param {string} q - 搜索词（空格分隔多词）
 * @returns {Promise<Array>} 匹配的能力锚点数组
 */
export async function querySearch(db, q) {
  const { results } = await db
    .prepare(
      `SELECT c.* FROM capabilities c
       INNER JOIN capabilities_fts fts ON c.rowid = fts.rowid
       WHERE capabilities_fts MATCH ?
       ORDER BY rank
       LIMIT 50`,
    )
    .bind(q)
    .all();
  return results.map(mapRow);
}

/**
 * LIKE 搜索回退（FTS5 无结果时使用，支持中文）
 *
 * @param {D1Database} db - D1 数据库实例
 * @param {string} q - 搜索词
 * @returns {Promise<Array>} 匹配的能力锚点数组
 */
export async function querySearchLike(db, q) {
  const pattern = `%${q}%`;
  const { results } = await db
    .prepare(
      `SELECT DISTINCT c.* FROM capabilities c
       WHERE c.name LIKE ?1 OR c.name_en LIKE ?1
          OR c."desc" LIKE ?1 OR c.desc_en LIKE ?1
          OR c.features LIKE ?1 OR c.features_en LIKE ?1
          OR c.category LIKE ?1
       ORDER BY c.updated_at DESC
       LIMIT 50`,
    )
    .bind(pattern)
    .all();
  return results.map(mapRow);
}

/**
 * 获取数据库实例
 *
 * @param {object} env - Cloudflare Pages 环境变量
 * @returns {D1Database|null} D1 数据库实例或 null
 */
export function getDB(env) {
  return env && env.skillmesh_db ? env.skillmesh_db : null;
}

/**
 * 静态数据回退：按 ID 查找
 *
 * @param {string} id - 能力锚点 ID
 * @returns {object|null}
 */
export function findCapStatic(id) {
  return CAPABILITIES.find((c) => c.id === id) || null;
}

/**
 * 静态数据回退：关键词搜索
 *
 * @param {string} q - 搜索词
 * @returns {Array} 匹配的能力锚点数组
 */
export function searchStatic(q) {
  const lower = q.toLowerCase();
  return CAPABILITIES.filter((c) => {
    const searchText = [
      c.name,
      c.name_en,
      c.desc,
      c.desc_en,
      ...(c.features || []),
      ...(c.features_en || []),
      c.category,
    ]
      .join(" ")
      .toLowerCase();
    return searchText.includes(lower);
  });
}
