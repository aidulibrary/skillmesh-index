/**
 * 联邦索引交换协议
 * =================
 * CCP 联邦化协议 — 节点间索引摘要交换。
 *
 * 协议设计：
 * - 节点间只交换摘要（id + name + category + trust_summary），不传输完整数据
 * - 详情由调用方按需查询源节点
 * - 摘要缓存于 federation_index_cache 表，TTL 由节点自行管理
 *
 * 交换格式：
 * {
 *   "protocol": "CCP",
 *   "version": "v1.0.0",
 *   "node": { id, name, endpoint },
 *   "capabilities": [{ id, name, name_en, category, trust_summary }],
 *   "count": N,
 *   "timestamp": "ISO8601"
 * }
 *
 * 版本：v1.0
 * 协议：CCP v1.0.0
 */

import { queryAll } from "../lib/db.js";
import { getNode, touchNode } from "./node.js";
import { structuredError } from "../lib/errors.js";

const CCP_VERSION = "v1.0.0";

function buildTrustSummary(cap) {
  return {
    usage_rate: cap.trustUsageRate || cap.trust_usage_rate || 0,
    success: cap.trustSuccess || cap.trust_success || 0.5,
    uncertainty: cap.evidenceUncertainty || cap.evidence_uncertainty || 0.5,
    time: cap.trustTime || cap.trust_time || 0.5,
  };
}

export async function buildExchangePayload(db, env) {
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

  const nodeId = env.SITE_DOMAIN || "skillmesh.礼字号.中国";
  const endpoint = `https://${nodeId}/api/ccp/v1`;

  return {
    protocol: "CCP",
    version: CCP_VERSION,
    node: {
      id: nodeId,
      name: "SkillMesh 主节点",
      endpoint,
    },
    capabilities: caps.map((c) => ({
      id: c.id,
      name: c.name || "",
      name_en: c.name_en || "",
      category: c.category || "",
      trust_summary: buildTrustSummary(c),
    })),
    count: caps.length,
    timestamp: new Date().toISOString(),
  };
}

export async function handleExchange(request, db, env) {
  if (!db) {
    return structuredError("DB_ERROR", {
      detail: { reason: "D1 database not available" },
    });
  }

  let body;
  try {
    body = await request.json();
  } catch (_) {
    return structuredError("INVALID_JSON");
  }

  if (!body.node || !body.node.id || !body.node.endpoint) {
    return structuredError("VALIDATION_ERROR", {
      detail: { field: "node", reason: "node.id and node.endpoint required" },
    });
  }

  if (!body.capabilities || !Array.isArray(body.capabilities)) {
    return structuredError("VALIDATION_ERROR", {
      detail: { field: "capabilities", reason: "required array" },
    });
  }

  try {
    const node = await getNode(db, body.node.id);
    if (!node) {
      return structuredError("NODE_NOT_FOUND", {
        detail: { node_id: body.node.id },
      });
    }

    if (node.status !== "active") {
      return structuredError("VALIDATION_ERROR", {
        detail: {
          node_id: body.node.id,
          status: node.status,
          reason: "node is not active",
        },
      });
    }

    const stmt = db.prepare(
      `INSERT OR REPLACE INTO federation_index_cache
       (node_id, capability_id, name, name_en, category, trust_usage_rate, trust_success, trust_uncertainty, cached_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    );

    const batch = [];
    for (const cap of body.capabilities) {
      batch.push(
        stmt.bind(
          body.node.id,
          cap.id,
          cap.name || "",
          cap.name_en || "",
          cap.category || "",
          cap.trust_summary?.usage_rate || 0,
          cap.trust_summary?.success || 0.5,
          cap.trust_summary?.uncertainty || 0.5,
        ),
      );
    }

    await db.batch(batch);

    await touchNode(db, body.node.id, body.capabilities.length);

    // S9-3：交换成功后写入 federation_exchanges 流水（健康面板数据源）
    await db
      .prepare(
        `INSERT INTO federation_exchanges (node_id, exchanged_at, capabilities_count, status)
         VALUES (?, datetime('now'), ?, 'completed')`,
      )
      .bind(body.node.id, body.capabilities.length)
      .run();

    const reply = await buildExchangePayload(db, env);

    return new Response(JSON.stringify(reply), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return structuredError("EXCHANGE_FAILED", {
      detail: { cause: e.message },
    });
  }
}

export async function searchFederated(db, env, q) {
  if (!db) return [];

  try {
    const pattern = `%${q}%`;
    const { results } = await db
      .prepare(
        `SELECT DISTINCT fic.*, fn.trust_weight AS node_trust_weight,
                fn.name AS node_name, fn.endpoint AS node_endpoint
         FROM federation_index_cache fic
         JOIN federation_nodes fn ON fic.node_id = fn.id
         WHERE fn.status = 'active'
           AND (fic.name LIKE ?1 OR fic.name_en LIKE ?1 OR fic.category LIKE ?1)
         ORDER BY fn.trust_weight DESC, fic.trust_success DESC
         LIMIT 50`,
      )
      .bind(pattern)
      .all();

    return results.map((r) => ({
      id: r.capability_id,
      name: r.name,
      name_en: r.name_en,
      category: r.category,
      trust_usage_rate: r.trust_usage_rate,
      trust_success: r.trust_success,
      trust_uncertainty: r.trust_uncertainty,
      _source: "federated",
      _source_node: r.node_name,
      _source_endpoint: r.node_endpoint,
      _node_trust_weight: r.node_trust_weight,
    }));
  } catch (_) {
    return [];
  }
}

export default { buildExchangePayload, handleExchange, searchFederated };
