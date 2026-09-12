/**
 * 能力锚点查询处理器
 * ===================
 * CCP 协议能力锚点查询端点。
 *
 * GET /api/ccp/v1/capabilities          → 全部能力锚点列表
 * GET /api/ccp/v1/capabilities/{id}     → 单个能力锚点详情
 * GET /api/ccp/v1/search?q={keyword}    → FTS5 全文搜索
 *
 * 缓存策略：
 * - 列表：KV 缓存 5 分钟
 * - 详情：KV 缓存 10 分钟
 * - 搜索：不缓存
 *
 * 版本：v1.0
 * 协议：CCP v1.0.0
 */

import {
  queryAll,
  queryOne,
  querySearch,
  querySearchLike,
  searchStatic,
  findCapStatic,
} from "../lib/db.js";
import { cacheGet, cacheSet, cacheKey, CACHE_TTL } from "../lib/cache.js";
import { jsonResponse } from "../lib/response.js";
import { structuredError } from "../lib/errors.js";
import { semanticSearch } from "../lib/semantic-search.js";
import { searchFederated } from "../federation/exchange.js";
import {
  computeUsageRate,
  computeWeightedScore,
  computeUncertainty,
} from "../lib/trust-vector.js";

const CCP_VERSION = "v1.0.0";

/**
 * D3：分类别名表（中/日文展示名 → 英文分类键）
 * 前端与文档展示的分类名为中文/日文，而数据库 category 字段存英文键，
 * 此处做归一化，使 ?category=数据处理 与 ?category=data 等价。
 */
const CATEGORY_ALIASES = {
  数据处理: "data",
  数据: "data",
  データ処理: "data",
  人工智能: "ai",
  智能: "ai",
  ai: "ai",
  媒体: "media",
  多媒体: "media",
  メディア: "media",
  语言: "language",
  自然语言: "language",
  言語: "language",
  开发: "dev",
  开发工具: "dev",
  開発: "dev",
};

function normalizeCategory(input) {
  const v = String(input || "").trim();
  if (!v) return "";
  return CATEGORY_ALIASES[v] || CATEGORY_ALIASES[v.toLowerCase()] || v.toLowerCase();
}

export async function handleList(db, env, options = {}) {
  const query = (options.q || "").trim();
  const category = (options.category || "").trim();
  const hasFilter = query.length > 0 || category.length > 0;

  const key = cacheKey("list");
  // D3：仅在无过滤条件时读取/写入全量列表缓存，避免过滤结果污染缓存
  if (!hasFilter) {
    const cached = await cacheGet(env, key);
    if (cached) {
      return jsonResponse(cached);
    }
  }

  let caps;
  if (db) {
    try {
      caps = await queryAll(db);
    } catch (_) {
      caps = (await import("../../../../_data/capabilities")).CAPABILITIES;
    }
  } else {
    caps = (await import("../../../../_data/capabilities")).CAPABILITIES;
  }

  // D3：服务端过滤（?q= 关键词 / ?category= 分类）
  let list = caps;
  if (category) {
    // D3：先做别名归一化（中文/日文分类名 → 英文键），再按分类字段匹配
    const needle = normalizeCategory(category);
    list = list.filter((c) =>
      String(c.category || "")
        .toLowerCase()
        .includes(needle),
    );
  }
  if (query) {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    list = list.filter((c) => {
      const haystack = [
        c.id,
        c.name,
        c.name_en,
        c.desc,
        c.desc_en,
        c.category,
        c.endpoint,
        ...(Array.isArray(c.features) ? c.features : []),
        ...(Array.isArray(c.features_en) ? c.features_en : []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return terms.every((term) => haystack.includes(term));
    });
  }

  const data = {
    protocol: "CCP",
    version: CCP_VERSION,
    count: list.length,
    total: caps.length,
    query: query || null,
    category: category || null,
    capabilities: list,
  };

  if (!hasFilter) {
    await cacheSet(env, key, data, CACHE_TTL.list);
  }
  return jsonResponse(data);
}

export async function handleDetail(db, env, capId) {
  const key = cacheKey("detail", capId);
  const cached = await cacheGet(env, key);
  if (cached) {
    return jsonResponse(cached);
  }

  let cap;
  if (db) {
    try {
      cap = await queryOne(db, capId);
    } catch (_) {
      cap = findCapStatic(capId);
    }
  } else {
    cap = findCapStatic(capId);
  }

  if (!cap) {
    return structuredError("CAPABILITY_NOT_FOUND", {
      detail: { id: capId },
    });
  }

  // S9-7：版本管理启用 — 返回最近 10 条版本历史
  let versions = [];
  if (db) {
    try {
      const { results } = await db
        .prepare(
          "SELECT version, changes, created_at FROM capability_versions WHERE cap_id = ? ORDER BY version DESC LIMIT 10",
        )
        .bind(capId)
        .all();
      versions = results || [];
    } catch (_) {}
  }

  const data = {
    ...cap,
    versions,
    version_count: versions.length,
    trust_radar: buildTrustRadar(cap),
  };

  await cacheSet(env, key, data, CACHE_TTL.detail);
  return jsonResponse(data);
}

function buildTrustRadar(cap) {
  const trustSource = cap.trustSource ?? 0.5;
  const trustUsage = cap.trustUsage ?? 0;
  const trustUsageRate = cap.trustUsageRate ?? computeUsageRate(trustUsage);
  const trustSuccess = cap.trustSuccess ?? 0.5;
  const trustRisk = cap.trustRisk ?? 0.5;
  const trustTime = cap.trustTime ?? 0.8;
  const evidenceCount = cap.evidence
    ? cap.evidence.count
    : (cap.evidence_count ?? 0);
  const uncertainty = cap.evidence
    ? cap.evidence.uncertainty
    : (cap.evidence_uncertainty ?? computeUncertainty(evidenceCount));

  const dimensions = [
    {
      name: "来源可信度",
      name_en: "Source Trust",
      value: Math.round(trustSource * 100) / 100,
      weight: 0.25,
    },
    {
      name: "使用痕迹",
      name_en: "Usage",
      value: Math.round(trustUsageRate * 100) / 100,
      weight: 0.2,
    },
    {
      name: "成功率",
      name_en: "Success Rate",
      value: Math.round(trustSuccess * 100) / 100,
      weight: 0.3,
    },
    {
      name: "低风险",
      name_en: "Low Risk",
      value: Math.round((1 - trustRisk) * 100) / 100,
      weight: 0.15,
    },
    {
      name: "时效性",
      name_en: "Freshness",
      value: Math.round(trustTime * 100) / 100,
      weight: 0.1,
    },
  ];

  const overall = computeWeightedScore(
    {
      trustSource,
      trustUsage,
      trustUsageRate,
      trustSuccess,
      trustRisk,
      trustTime,
    },
    uncertainty,
  );

  return {
    dimensions,
    overall: Math.round(overall * 100) / 100,
    evidence_count: evidenceCount,
    uncertainty: Math.round(uncertainty * 100) / 100,
  };
}

export async function handleSearch(db, env, q, federated = false) {
  if (!q || q.trim().length < 1) {
    return structuredError("VALIDATION_ERROR", {
      detail: { field: "q", reason: "missing or empty" },
    });
  }

  let results;
  if (db) {
    try {
      const ftsQuery = q
        .trim()
        .split(/\s+/)
        .map((w) => `"${w}"`)
        .join(" OR ");
      results = await querySearch(db, ftsQuery);
      if (results.length === 0) {
        results = await querySearchLike(db, q.trim());
      }
    } catch (_) {
      results = await querySearchLike(db, q.trim());
    }
  } else {
    results = searchStatic(q);
  }

  const enhanced = await semanticSearch(env, db, q.trim(), results);

  let federatedResults = [];
  if (federated && db) {
    federatedResults = await searchFederated(db, env, q.trim());
  }

  const allResults = [
    ...enhanced.map((r) => ({ ...r, _source: "local" })),
    ...federatedResults,
  ];

  return jsonResponse({
    protocol: "CCP",
    version: CCP_VERSION,
    query: q,
    count: allResults.length,
    federated,
    results: allResults,
  });
}

export default { handleList, handleDetail, handleSearch };
