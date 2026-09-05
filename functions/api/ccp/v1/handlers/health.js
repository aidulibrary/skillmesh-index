/**
 * 联邦网络健康检查 API
 * ======================
 * CCP 联邦网络可观测性 — 节点状态、交换频率、索引覆盖率。
 *
 * 端点：
 *   GET /api/ccp/v1/health              整体健康概览
 *   GET /api/ccp/v1/health/nodes        节点状态列表
 *   GET /api/ccp/v1/health/nodes/{id}   单个节点状态
 *   GET /api/ccp/v1/health/stats         统计摘要
 *
 * 版本：v1.0
 * 协议：CCP v1.0.0
 */

import { jsonResponse } from "../lib/response.js";
import { structuredError } from "../lib/errors.js";

const CCP_VERSION = "v1.0.0";

/**
 * 获取各节点状态
 */
async function getNodesStatus(db) {
  const { results: nodes } = await db
    .prepare("SELECT * FROM federation_nodes")
    .all();

  return (nodes || []).map((node) => ({
    id: node.id,
    name: node.name,
    endpoint: node.endpoint,
    trust_score: node.trust_score || 0.5,
    status: determineNodeStatus(node),
    last_exchange: node.last_exchange || null,
    capabilities_count: node.capabilities_count || 0,
    exchange_frequency: node.exchange_frequency || "manual",
    is_active: node.is_active !== false,
    added_at: node.added_at || null,
  }));
}

/**
 * 判断节点健康状态
 */
function determineNodeStatus(node) {
  if (node.is_active === false) return "offline";

  const lastExchange = node.last_exchange ? new Date(node.last_exchange) : null;
  if (!lastExchange) return "unknown";

  const hoursSinceExchange = (Date.now() - lastExchange.getTime()) / 3600000;

  if (hoursSinceExchange < 1) return "healthy";
  if (hoursSinceExchange < 24) return "degraded";
  if (hoursSinceExchange < 72) return "stale";
  return "offline";
}

/**
 * 获取索引覆盖率
 */
async function getIndexCoverage(db) {
  const totalResult = await db
    .prepare("SELECT COUNT(*) as total FROM capabilities")
    .first();
  const total = totalResult?.total || 0;

  const { results: indexedCounts } = await db
    .prepare(
      "SELECT node_id, COUNT(*) as count FROM federation_index_cache GROUP BY node_id",
    )
    .all();

  const indexCoverage = (indexedCounts || []).map((row) => ({
    node_id: row.node_id,
    indexed_count: row.count,
    coverage: total > 0 ? row.count / total : 0,
  }));

  return {
    total_capabilities: total,
    coverage_by_node: indexCoverage,
    average_coverage:
      indexCoverage.length > 0
        ? indexCoverage.reduce((s, c) => s + c.coverage, 0) /
          indexCoverage.length
        : 0,
  };
}

/**
 * 获取遥测统计
 */
async function getTelemetryStats(db) {
  const totalResult = await db
    .prepare("SELECT COUNT(*) as total FROM telemetry_records")
    .first();

  const recentResult = await db
    .prepare(
      "SELECT COUNT(*) as count FROM telemetry_records WHERE created_at > datetime('now', '-24 hours')",
    )
    .first();

  const { results: byType } = await db
    .prepare(
      "SELECT event_type, COUNT(*) as count FROM telemetry_records GROUP BY event_type ORDER BY count DESC",
    )
    .all();

  return {
    total_telemetries: totalResult?.total || 0,
    last_24h: recentResult?.count || 0,
    by_type: byType || [],
  };
}

/**
 * 整体健康概览
 */
async function getHealthOverview(db) {
  const nodes = await getNodesStatus(db);
  const coverage = await getIndexCoverage(db);
  const telemetry = await getTelemetryStats(db);

  const healthyNodes = nodes.filter((n) => n.status === "healthy").length;
  const degradedNodes = nodes.filter((n) => n.status === "degraded").length;
  const offlineNodes = nodes.filter(
    (n) =>
      n.status === "offline" || n.status === "stale" || n.status === "unknown",
  ).length;

  const overallStatus =
    offlineNodes > 0
      ? "degraded"
      : degradedNodes > 0
        ? "degraded"
        : nodes.length === 0
          ? "empty"
          : "healthy";

  return jsonResponse({
    protocol: "CCP",
    version: CCP_VERSION,
    timestamp: new Date().toISOString(),
    status: overallStatus,
    summary: {
      total_nodes: nodes.length,
      healthy_nodes: healthyNodes,
      degraded_nodes: degradedNodes,
      offline_nodes: offlineNodes,
    },
    index_coverage: coverage,
    telemetry: telemetry,
    nodes: nodes,
  });
}

/**
 * 节点列表
 */
async function listNodes(db) {
  const nodes = await getNodesStatus(db);

  return jsonResponse({
    protocol: "CCP",
    version: CCP_VERSION,
    count: nodes.length,
    nodes,
    status_summary: {
      healthy: nodes.filter((n) => n.status === "healthy").length,
      degraded: nodes.filter((n) => n.status === "degraded").length,
      stale: nodes.filter((n) => n.status === "stale").length,
      offline: nodes.filter((n) => n.status === "offline").length,
      unknown: nodes.filter((n) => n.status === "unknown").length,
    },
  });
}

/**
 * 单个节点状态
 */
async function getNodeStatus(nodeId, db) {
  const node = await db
    .prepare("SELECT * FROM federation_nodes WHERE id = ?")
    .bind(nodeId)
    .first();

  if (!node) {
    return structuredError("CAPABILITY_NOT_FOUND", {
      detail: { reason: `Node ${nodeId} not found` },
    });
  }

  const { results: recentExchanges } = await db
    .prepare(
      "SELECT * FROM federation_exchanges WHERE node_id = ? ORDER BY exchanged_at DESC LIMIT 10",
    )
    .bind(nodeId)
    .all();

  const { results: indexedCaps } = await db
    .prepare(
      "SELECT capability_id as cap_id FROM federation_index_cache WHERE node_id = ?",
    )
    .bind(nodeId)
    .all();

  return jsonResponse({
    protocol: "CCP",
    version: CCP_VERSION,
    node: {
      ...node,
      status: determineNodeStatus(node),
      recent_exchanges: recentExchanges || [],
      indexed_capabilities: (indexedCaps || []).map((c) => c.cap_id),
      indexed_count: (indexedCaps || []).length,
    },
  });
}

/**
 * 统计摘要
 */
async function getStats(db) {
  const capabilitiesResult = await db
    .prepare("SELECT COUNT(*) as total FROM capabilities")
    .first();

  const nodesResult = await db
    .prepare("SELECT COUNT(*) as total FROM federation_nodes")
    .first();

  const contributorsResult = await db
    .prepare("SELECT COUNT(*) as total FROM contributors")
    .first();

  const telemetryResult = await db
    .prepare("SELECT COUNT(*) as total FROM telemetry_records")
    .first();

  const proposalsResult = await db
    .prepare("SELECT COUNT(*) as total FROM governance_proposals")
    .first();

  const categoriesResult = await db
    .prepare(
      "SELECT category, COUNT(*) as count FROM capabilities GROUP BY category ORDER BY count DESC",
    )
    .all();

  return jsonResponse({
    protocol: "CCP",
    version: CCP_VERSION,
    timestamp: new Date().toISOString(),
    stats: {
      capabilities: capabilitiesResult?.total || 0,
      federation_nodes: nodesResult?.total || 0,
      contributors: contributorsResult?.total || 0,
      telemetries: telemetryResult?.total || 0,
      governance_proposals: proposalsResult?.total || 0,
    },
    categories: categoriesResult?.results || [],
  });
}

/**
 * 主路由
 */
export async function handleHealth(request, db) {
  const url = new URL(request.url);
  const path = url.pathname.replace("/api/ccp/v1/health", "");

  if (path === "" || path === "/") {
    return getHealthOverview(db);
  }

  if (path === "/nodes" || path === "/nodes/") {
    return listNodes(db);
  }

  if (path === "/stats") {
    return getStats(db);
  }

  const nodeMatch = path.match(/^\/nodes\/([^/]+)$/);
  if (nodeMatch) {
    return getNodeStatus(nodeMatch[1], db);
  }

  return structuredError("CAPABILITY_NOT_FOUND", {
    detail: { reason: "Health endpoint not found" },
  });
}

export default { handleHealth };
