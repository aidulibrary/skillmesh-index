/**
 * 联邦节点管理
 * =============
 * CCP 联邦化协议 — 节点注册与发现。
 *
 * 策略：渐进式（手动注册，验证价值后演进到 ActivityPub）
 *
 * 功能：
 * - 本节点信息披露（节点发现端点）
 * - 联邦节点 CRUD（手动添加/移除/更新信任权重）
 * - 联邦节点列表查询
 *
 * 版本：v1.0
 * 协议：CCP v1.0.0
 */

const CCP_VERSION = "v1.0.0";

export function getNodeInfo(env) {
  return {
    protocol: "CCP",
    version: CCP_VERSION,
    node: {
      id: env.SITE_DOMAIN || "skillmesh.礼字号.中国",
      name: "SkillMesh 主节点",
      endpoint: `https://${env.SITE_DOMAIN || "skillmesh.礼字号.中国"}/api/ccp/v1`,
      capabilities_count: null,
      features: ["search", "telemetry", "contribute", "federation", "adapters"],
      federation_policy: "manual",
      contact:
        env.GITHUB_REPO || "https://github.com/aidulibrary/skillmesh-index",
    },
  };
}

export async function listNodes(db) {
  if (!db) return [];
  const { results } = await db
    .prepare(
      "SELECT * FROM federation_nodes WHERE status = 'active' ORDER BY trust_weight DESC",
    )
    .all();
  return results;
}

export async function getNode(db, nodeId) {
  if (!db) return null;
  return await db
    .prepare("SELECT * FROM federation_nodes WHERE id = ?")
    .bind(nodeId)
    .first();
}

export async function addNode(db, node) {
  if (!db) throw new Error("D1 not available");
  await db
    .prepare(
      `INSERT OR REPLACE INTO federation_nodes
       (id, name, endpoint, description, trust_weight, status, last_seen)
       VALUES (?, ?, ?, ?, ?, 'active', datetime('now'))`,
    )
    .bind(
      node.id,
      node.name,
      node.endpoint,
      node.description || "",
      node.trust_weight || 0.5,
    )
    .run();
  return getNode(db, node.id);
}

export async function updateNode(db, nodeId, updates) {
  if (!db) throw new Error("D1 not available");
  const existing = await getNode(db, nodeId);
  if (!existing) return null;

  const fields = [];
  const values = [];
  for (const [k, v] of Object.entries(updates)) {
    if (
      ["name", "endpoint", "description", "trust_weight", "status"].includes(k)
    ) {
      fields.push(`${k} = ?`);
      values.push(v);
    }
  }
  if (fields.length === 0) return existing;

  fields.push("updated_at = datetime('now')");
  values.push(nodeId);

  await db
    .prepare(`UPDATE federation_nodes SET ${fields.join(", ")} WHERE id = ?`)
    .bind(...values)
    .run();

  return getNode(db, nodeId);
}

export async function removeNode(db, nodeId) {
  if (!db) throw new Error("D1 not available");
  await db
    .prepare("DELETE FROM federation_nodes WHERE id = ?")
    .bind(nodeId)
    .run();
  return true;
}

export async function touchNode(db, nodeId, count) {
  if (!db) return;
  await db
    .prepare(
      `UPDATE federation_nodes SET
         last_seen = datetime('now'),
         capabilities_count = ?,
         updated_at = datetime('now')
       WHERE id = ?`,
    )
    .bind(count || 0, nodeId)
    .run();
}

export default {
  getNodeInfo,
  listNodes,
  getNode,
  addNode,
  updateNode,
  removeNode,
  touchNode,
};
