/**
 * 节点信任策略端点
 * ==================
 * CCP 联邦节点信任策略配置。
 *
 * 每个联邦节点可以定义自己的信任策略（权重偏好），
 * 在联邦交换时传递给其他节点，用于计算个性化信任分。
 *
 * GET  /api/ccp/v1/federation/nodes/{id}/trust-policy   → 查看策略
 * PUT  /api/ccp/v1/federation/nodes/{id}/trust-policy   → 更新策略
 *
 * 版本：v1.0
 * 协议：CCP v1.0.0
 */

import { jsonResponse } from "../lib/response.js";
import { structuredError } from "../lib/errors.js";

const DEFAULT_POLICY = {
  weights: {
    source: 0.25,
    usage: 0.2,
    success: 0.3,
    risk: 0.15,
    time: 0.1,
  },
  thresholds: {
    min_trust: 0.3,
    min_evidence: 1,
    max_uncertainty: 0.8,
  },
  auto_accept: true,
  description: "Default trust policy",
};

export async function handleTrustPolicy(request, db, nodeId) {
  if (!db) {
    return structuredError("DB_ERROR");
  }

  const node = await db
    .prepare("SELECT * FROM federation_nodes WHERE id = ?")
    .bind(nodeId)
    .first();

  if (!node) {
    return structuredError("CAPABILITY_NOT_FOUND", {
      detail: { reason: `Node ${nodeId} not found` },
    });
  }

  if (request.method === "GET") {
    const policy = node.trust_policy
      ? typeof node.trust_policy === "string"
        ? JSON.parse(node.trust_policy)
        : node.trust_policy
      : DEFAULT_POLICY;

    return jsonResponse({
      node_id: nodeId,
      node_name: node.name,
      policy,
      defaults: DEFAULT_POLICY,
    });
  }

  if (request.method === "PUT") {
    let body;
    try {
      body = await request.json();
    } catch (_) {
      return structuredError("INVALID_JSON");
    }

    const policy = {
      weights: {
        source: body.weights?.source ?? DEFAULT_POLICY.weights.source,
        usage: body.weights?.usage ?? DEFAULT_POLICY.weights.usage,
        success: body.weights?.success ?? DEFAULT_POLICY.weights.success,
        risk: body.weights?.risk ?? DEFAULT_POLICY.weights.risk,
        time: body.weights?.time ?? DEFAULT_POLICY.weights.time,
      },
      thresholds: {
        min_trust:
          body.thresholds?.min_trust ?? DEFAULT_POLICY.thresholds.min_trust,
        min_evidence:
          body.thresholds?.min_evidence ??
          DEFAULT_POLICY.thresholds.min_evidence,
        max_uncertainty:
          body.thresholds?.max_uncertainty ??
          DEFAULT_POLICY.thresholds.max_uncertainty,
      },
      auto_accept: body.auto_accept ?? DEFAULT_POLICY.auto_accept,
      description: body.description || DEFAULT_POLICY.description,
    };

    const totalWeight =
      policy.weights.source +
      policy.weights.usage +
      policy.weights.success +
      policy.weights.risk +
      policy.weights.time;

    if (Math.abs(totalWeight - 1.0) > 0.01) {
      return structuredError("VALIDATION_ERROR", {
        detail: {
          field: "weights",
          reason: `Weights must sum to 1.0, got ${totalWeight.toFixed(2)}`,
        },
      });
    }

    await db
      .prepare(
        `UPDATE federation_nodes SET
           trust_policy = ?,
           updated_at = datetime('now')
         WHERE id = ?`,
      )
      .bind(JSON.stringify(policy), nodeId)
      .run();

    return jsonResponse({
      node_id: nodeId,
      node_name: node.name,
      policy,
      updated: true,
    });
  }

  return structuredError("METHOD_NOT_ALLOWED");
}

export default { handleTrustPolicy };
