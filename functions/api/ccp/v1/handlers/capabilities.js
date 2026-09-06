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

const CCP_VERSION = "v1.0.0";

export async function handleList(db, env) {
  const key = cacheKey("list");
  const cached = await cacheGet(env, key);
  if (cached) {
    return jsonResponse(cached);
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

  const data = {
    protocol: "CCP",
    version: CCP_VERSION,
    count: caps.length,
    capabilities: caps,
  };

  await cacheSet(env, key, data, CACHE_TTL.list);
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
  };

  await cacheSet(env, key, data, CACHE_TTL.detail);
  return jsonResponse(data);
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
