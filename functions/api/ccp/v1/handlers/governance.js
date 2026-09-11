/**
 * 联邦治理 API 处理器
 * ===================
 * CCP 联邦治理共识协议 — 提案管理、投票、批准。
 *
 * 端点：
 *   POST   /api/ccp/v1/governance/proposals       创建提案
 *   GET    /api/ccp/v1/governance/proposals       列出提案
 *   GET    /api/ccp/v1/governance/proposals/{id}  查看提案
 *   POST   /api/ccp/v1/governance/proposals/{id}/vote  投票
 *   GET    /api/ccp/v1/governance/proposals/{id}/votes 查看投票
 *
 * 版本：v1.0
 * 协议：CCP-GOV-001
 */

import { jsonResponse } from "../lib/response.js";
import { structuredError } from "../lib/errors.js";

const CCP_VERSION = "v1.0.0";
const VOTING_PERIOD_HOURS = 168; // 7 days
const QUORUM_MIN_NODES = 3;
const APPROVAL_THRESHOLD = 2 / 3;

/**
 * 计算节点投票权重
 * voteWeight = 1 + (trustScore - 0.5) * 2
 */
function computeVoteWeight(trustScore) {
  return Math.max(0, Math.min(2, 1 + (trustScore - 0.5) * 2));
}

/**
 * 获取节点信息（含信任分数）
 */
async function getNodeInfo(db, nodeId) {
  const node = await db
    .prepare("SELECT id, name, trust_score FROM federation_nodes WHERE id = ?")
    .bind(nodeId)
    .first();
  return node;
}

/**
 * 创建提案
 */
async function createProposal(request, db) {
  let body;
  try {
    body = await request.json();
  } catch (_) {
    return structuredError("INVALID_JSON");
  }

  const { title, description, type, node_id } = body;

  if (!title || !description || !type || !node_id) {
    return structuredError("INVALID_SCHEMA", {
      detail: {
        errors: ["title, description, type, node_id are required"],
      },
    });
  }

  const validTypes = [
    "spec-change",
    "api-change",
    "policy-change",
    "node-management",
    "other",
  ];
  if (!validTypes.includes(type)) {
    return structuredError("INVALID_SCHEMA", {
      detail: { errors: [`type must be one of: ${validTypes.join(", ")}`] },
    });
  }

  const node = await getNodeInfo(db, node_id);
  if (!node) {
    return structuredError("CAPABILITY_NOT_FOUND", {
      detail: { reason: `Node ${node_id} not found` },
    });
  }

  const id = `ccp-gov-${Date.now().toString(36)}`;
  const now = new Date().toISOString();

  await db
    .prepare(
      `INSERT INTO governance_proposals
       (id, title, description, type, status, proposer_node_id, proposer_name, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'draft', ?, ?, ?, ?)`,
    )
    .bind(id, title, description, type, node_id, node.name, now, now)
    .run();

  return jsonResponse(
    {
      protocol: "CCP",
      version: CCP_VERSION,
      proposal: {
        id,
        title,
        description,
        type,
        status: "draft",
        proposer_node_id: node_id,
        proposer_name: node.name,
        created_at: now,
      },
    },
    201,
  );
}

/**
 * 列出提案
 */
async function listProposals(url, db) {
  const status = url.searchParams.get("status");
  const type = url.searchParams.get("type");

  let query = "SELECT * FROM governance_proposals WHERE 1=1";
  const params = [];

  if (status) {
    query += " AND status = ?";
    params.push(status);
  }
  if (type) {
    query += " AND type = ?";
    params.push(type);
  }

  query += " ORDER BY created_at DESC LIMIT 50";

  const { results } = await db
    .prepare(query)
    .bind(...params)
    .all();

  return jsonResponse({
    protocol: "CCP",
    version: CCP_VERSION,
    count: results.length,
    proposals: results,
  });
}

/**
 * 查看提案详情
 */
async function getProposal(proposalId, db) {
  const proposal = await db
    .prepare("SELECT * FROM governance_proposals WHERE id = ?")
    .bind(proposalId)
    .first();

  if (!proposal) {
    return structuredError("CAPABILITY_NOT_FOUND", {
      detail: { reason: `Proposal ${proposalId} not found` },
    });
  }

  const { results: votes } = await db
    .prepare("SELECT * FROM governance_votes WHERE proposal_id = ?")
    .bind(proposalId)
    .all();

  return jsonResponse({
    protocol: "CCP",
    version: CCP_VERSION,
    proposal,
    votes: votes || [],
    vote_count: votes ? votes.length : 0,
  });
}

/**
 * 更新提案状态
 */
async function updateProposal(request, proposalId, db) {
  const proposal = await db
    .prepare("SELECT * FROM governance_proposals WHERE id = ?")
    .bind(proposalId)
    .first();

  if (!proposal) {
    return structuredError("CAPABILITY_NOT_FOUND", {
      detail: { reason: `Proposal ${proposalId} not found` },
    });
  }

  let body;
  try {
    body = await request.json();
  } catch (_) {
    return structuredError("INVALID_JSON");
  }

  const { status } = body;

  const validTransitions = {
    draft: ["proposed"],
    proposed: ["voting"],
    voting: [],
    accepted: ["implemented"],
    rejected: ["draft"],
    implemented: [],
  };

  if (!validTransitions[proposal.status]?.includes(status)) {
    return structuredError("INVALID_SCHEMA", {
      detail: {
        errors: [`Cannot transition from ${proposal.status} to ${status}`],
      },
    });
  }

  const now = new Date().toISOString();
  const updates = { status, updated_at: now };

  if (status === "voting") {
    updates.voting_start_at = now;
    updates.voting_end_at = new Date(
      Date.now() + VOTING_PERIOD_HOURS * 3600000,
    ).toISOString();
  }

  await db
    .prepare(
      `UPDATE governance_proposals
       SET status = ?, updated_at = ?,
           voting_start_at = COALESCE(?, voting_start_at),
           voting_end_at = COALESCE(?, voting_end_at)
       WHERE id = ?`,
    )
    .bind(
      updates.status,
      updates.updated_at,
      updates.voting_start_at || null,
      updates.voting_end_at || null,
      proposalId,
    )
    .run();

  return jsonResponse({
    protocol: "CCP",
    version: CCP_VERSION,
    proposal: { ...proposal, ...updates },
  });
}

/**
 * 投票
 */
async function voteOnProposal(request, proposalId, db) {
  const proposal = await db
    .prepare("SELECT * FROM governance_proposals WHERE id = ?")
    .bind(proposalId)
    .first();

  if (!proposal) {
    return structuredError("CAPABILITY_NOT_FOUND", {
      detail: { reason: `Proposal ${proposalId} not found` },
    });
  }

  if (proposal.status !== "voting") {
    return structuredError("INVALID_SCHEMA", {
      detail: {
        errors: [
          `Proposal is in ${proposal.status} status, not accepting votes`,
        ],
      },
    });
  }

  const now = new Date().toISOString();
  if (proposal.voting_end_at && now > proposal.voting_end_at) {
    return structuredError("INVALID_SCHEMA", {
      detail: { errors: ["Voting period has ended"] },
    });
  }

  let body;
  try {
    body = await request.json();
  } catch (_) {
    return structuredError("INVALID_JSON");
  }

  const { node_id, vote } = body;

  if (!node_id || !vote) {
    return structuredError("INVALID_SCHEMA", {
      detail: { errors: ["node_id and vote are required"] },
    });
  }

  if (!["approve", "reject", "abstain"].includes(vote)) {
    return structuredError("INVALID_SCHEMA", {
      detail: { errors: ["vote must be: approve, reject, or abstain"] },
    });
  }

  const node = await getNodeInfo(db, node_id);
  if (!node) {
    return structuredError("CAPABILITY_NOT_FOUND", {
      detail: { reason: `Node ${node_id} not found` },
    });
  }

  const weight = computeVoteWeight(node.trust_score || 0.5);

  const existing = await db
    .prepare(
      "SELECT * FROM governance_votes WHERE proposal_id = ? AND node_id = ?",
    )
    .bind(proposalId, node_id)
    .first();

  if (existing) {
    await db
      .prepare(
        "UPDATE governance_votes SET vote = ?, weight = ?, voted_at = ? WHERE proposal_id = ? AND node_id = ?",
      )
      .bind(vote, weight, now, proposalId, node_id)
      .run();
  } else {
    await db
      .prepare(
        `INSERT INTO governance_votes (proposal_id, node_id, node_name, vote, weight, voted_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .bind(proposalId, node_id, node.name, vote, weight, now)
      .run();
  }

  // 检查是否达到法定人数并自动统计
  const { results: allVotes } = await db
    .prepare("SELECT * FROM governance_votes WHERE proposal_id = ?")
    .bind(proposalId)
    .all();

  const totalWeight = allVotes.reduce((sum, v) => sum + v.weight, 0);
  const approveWeight = allVotes
    .filter((v) => v.vote === "approve")
    .reduce((sum, v) => sum + v.weight, 0);

  if (
    allVotes.length >= QUORUM_MIN_NODES &&
    approveWeight / totalWeight > APPROVAL_THRESHOLD
  ) {
    await db
      .prepare(
        "UPDATE governance_proposals SET status = 'accepted', updated_at = ? WHERE id = ?",
      )
      .bind(now, proposalId)
      .run();
  }

  return jsonResponse({
    protocol: "CCP",
    version: CCP_VERSION,
    vote: {
      proposal_id: proposalId,
      node_id,
      node_name: node.name,
      vote,
      weight,
      voted_at: now,
    },
    tally: {
      total_nodes: allVotes.length,
      total_weight: totalWeight,
      approve_weight: approveWeight,
      quorum_met: allVotes.length >= QUORUM_MIN_NODES,
      threshold_met: approveWeight / totalWeight > APPROVAL_THRESHOLD,
    },
  });
}

/**
 * 查看投票结果
 */
async function getVotes(proposalId, db) {
  const proposal = await db
    .prepare("SELECT * FROM governance_proposals WHERE id = ?")
    .bind(proposalId)
    .first();

  if (!proposal) {
    return structuredError("CAPABILITY_NOT_FOUND", {
      detail: { reason: `Proposal ${proposalId} not found` },
    });
  }

  const { results: votes } = await db
    .prepare("SELECT * FROM governance_votes WHERE proposal_id = ?")
    .bind(proposalId)
    .all();

  const totalWeight = (votes || []).reduce((sum, v) => sum + v.weight, 0);
  const approveWeight = (votes || [])
    .filter((v) => v.vote === "approve")
    .reduce((sum, v) => sum + v.weight, 0);
  const rejectWeight = (votes || [])
    .filter((v) => v.vote === "reject")
    .reduce((sum, v) => sum + v.weight, 0);
  const abstainWeight = (votes || [])
    .filter((v) => v.vote === "abstain")
    .reduce((sum, v) => sum + v.weight, 0);

  return jsonResponse({
    protocol: "CCP",
    version: CCP_VERSION,
    proposal_id: proposalId,
    proposal_status: proposal.status,
    votes: votes || [],
    tally: {
      total_nodes: (votes || []).length,
      total_weight: totalWeight,
      approve_weight: approveWeight,
      reject_weight: rejectWeight,
      abstain_weight: abstainWeight,
      approval_ratio: totalWeight > 0 ? approveWeight / totalWeight : 0,
      quorum_met: (votes || []).length >= QUORUM_MIN_NODES,
      threshold_met:
        totalWeight > 0
          ? approveWeight / totalWeight > APPROVAL_THRESHOLD
          : false,
    },
  });
}

/**
 * 主路由
 */
export async function handleGovernance(request, db) {
  const url = new URL(request.url);
  const path = url.pathname.replace("/api/ccp/v1/governance", "");

  if (path === "/proposals" || path === "/proposals/") {
    if (request.method === "POST") return createProposal(request, db);
    if (request.method === "GET") return listProposals(url, db);
  }

  const proposalMatch = path.match(/^\/proposals\/([^/]+)$/);
  if (proposalMatch) {
    const proposalId = proposalMatch[1];
    if (request.method === "GET") return getProposal(proposalId, db);
    if (request.method === "PATCH")
      return updateProposal(request, proposalId, db);
  }

  const voteMatch = path.match(/^\/proposals\/([^/]+)\/vote$/);
  if (voteMatch) {
    const proposalId = voteMatch[1];
    if (request.method === "POST")
      return voteOnProposal(request, proposalId, db);
  }

  const votesMatch = path.match(/^\/proposals\/([^/]+)\/votes$/);
  if (votesMatch) {
    const proposalId = votesMatch[1];
    if (request.method === "GET") return getVotes(proposalId, db);
  }

  return structuredError("CAPABILITY_NOT_FOUND", {
    detail: { reason: "Governance endpoint not found" },
  });
}

export default { handleGovernance };
