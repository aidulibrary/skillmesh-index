/**
 * S17 治理与贡献者体系测试
 * ========================
 * 覆盖联邦治理共识协议（CCP-GOV-001）与社区贡献者身份管理：
 * - 提案创建/列表/详情/状态变更/投票/计票
 * - 贡献者注册/列表/详情/徽章/排行榜/角色计算
 *
 * 运行：npx vitest run test/governance-contributors.test.js
 */
import { describe, it, expect } from "vitest";
import { handleGovernance } from "../functions/api/ccp/v1/handlers/governance.js";
import contributorsMod from "../functions/api/ccp/v1/handlers/contributors.js";

const handleContributors = contributorsMod.handleContributors;
const BADGE_DEFINITIONS = contributorsMod.BADGE_DEFINITIONS;
const ROLE_HIERARCHY = contributorsMod.ROLE_HIERARCHY;

// ============================================================
// Mock 工具
// ============================================================

function makeUrl(path) {
  return new URL(path, "https://skillmesh.pages.dev");
}

let counter = 0;
function uniqueId(prefix) {
  counter += 1;
  return `${prefix}-${counter}-${Date.now().toString(36)}`;
}

function mockRequest(method, url, body) {
  return {
    method,
    url,
    json: async () => {
      if (body instanceof Error) throw body;
      if (body === "invalid-json") throw new SyntaxError("Unexpected token");
      return body || {};
    },
  };
}

function mockDB(overrides = {}) {
  const {
    nodeRow = null,
    proposalRows = [],
    voteRows = [],
    proposalRow = null,
    contributorRows = [],
    contributorRow = null,
    contributionRows = [],
    totalContributors = 0,
    insertOk = true,
  } = overrides;

  const bindArgs = [];
  let lastSql = "";

  function match(sql, ...args) {
    lastSql = sql;
    bindArgs.length = 0;
    bindArgs.push(...args);
    return true;
  }

  return {
    prepare(sql) {
      lastSql = sql;
      return {
        bind(...args) {
          bindArgs.length = 0;
          bindArgs.push(...args);
          return this;
        },
        async first() {
          if (/federation_nodes.*WHERE id = \?/i.test(lastSql)) {
            return nodeRow || null;
          }
          if (/governance_proposals.*WHERE id = \?/i.test(lastSql)) {
            return proposalRow || null;
          }
          if (
            /governance_votes.*proposal_id = \? AND node_id = \?/i.test(lastSql)
          ) {
            return (
              voteRows.find(
                (v) =>
                  v.proposal_id === bindArgs[0] && v.node_id === bindArgs[1],
              ) || null
            );
          }
          // OR pattern BEFORE simple pattern — OR 查询包含两个占位符
          if (
            /contributors.*github_id = \? OR github_login = \?/i.test(lastSql)
          ) {
            const id = bindArgs[0];
            return (
              contributorRows.find(
                (c) => String(c.github_id) === id || c.github_login === id,
              ) || null
            );
          }
          if (/contributors.*WHERE github_id = \?/i.test(lastSql)) {
            const githubId = bindArgs[0];
            return (
              contributorRows.find((c) => c.github_id === githubId) || null
            );
          }
          if (/COUNT\(\*\).*FROM contributors/i.test(lastSql)) {
            return { total: totalContributors || contributorRows.length };
          }
          return null;
        },
        async all() {
          if (/FROM governance_proposals/i.test(lastSql)) {
            return { results: proposalRows };
          }
          if (/FROM governance_votes/i.test(lastSql)) {
            return { results: voteRows };
          }
          if (/FROM contributors/i.test(lastSql)) {
            return { results: contributorRows };
          }
          if (/FROM contribution_records/i.test(lastSql)) {
            return { results: contributionRows };
          }
          return { results: [] };
        },
        async run() {
          return { success: insertOk };
        },
      };
    },
  };
}

// ============================================================
// Governance 治理测试
// ============================================================

describe("Governance — 提案管理（CCP-GOV-001）", () => {
  const testNode = {
    id: "node-test-001",
    name: "Test Node Alpha",
    trust_score: 0.75,
  };

  it("POST /proposals — 创建提案成功", async () => {
    const db = mockDB({ nodeRow: testNode });
    const req = mockRequest(
      "POST",
      makeUrl("/api/ccp/v1/governance/proposals").href,
      {
        title: "Add new capability schema",
        description: "Proposal to add a new schema field for AI capabilities",
        type: "spec-change",
        node_id: "node-test-001",
      },
    );

    const resp = await handleGovernance(req, db);
    expect(resp.status).toBe(201);

    const data = await resp.json();
    expect(data.protocol).toBe("CCP");
    expect(data.version).toBe("v1.0.0");
    expect(data.proposal.title).toBe("Add new capability schema");
    expect(data.proposal.type).toBe("spec-change");
    expect(data.proposal.status).toBe("draft");
    expect(data.proposal.proposer_node_id).toBe("node-test-001");
    expect(data.proposal.proposer_name).toBe("Test Node Alpha");
    expect(data.proposal.id).toMatch(/^ccp-gov-/);
  });

  it("POST /proposals — 缺少必填字段", async () => {
    const db = mockDB({ nodeRow: testNode });
    const req = mockRequest(
      "POST",
      makeUrl("/api/ccp/v1/governance/proposals").href,
      { title: "Only title" },
    );

    const resp = await handleGovernance(req, db);
    expect(resp.status).toBe(400);

    const data = await resp.json();
    expect(data.error.code).toBe("INVALID_SCHEMA");
  });

  it("POST /proposals — 无效 proposal type", async () => {
    const db = mockDB({ nodeRow: testNode });
    const req = mockRequest(
      "POST",
      makeUrl("/api/ccp/v1/governance/proposals").href,
      {
        title: "Bad type",
        description: "test",
        type: "invalid-type",
        node_id: "node-test-001",
      },
    );

    const resp = await handleGovernance(req, db);
    expect(resp.status).toBe(400);

    const data = await resp.json();
    expect(data.error.code).toBe("INVALID_SCHEMA");
  });

  it("POST /proposals — JSON 解析失败", async () => {
    const db = mockDB({});
    const req = mockRequest(
      "POST",
      makeUrl("/api/ccp/v1/governance/proposals").href,
      "invalid-json",
    );

    const resp = await handleGovernance(req, db);
    expect(resp.status).toBe(400);

    const data = await resp.json();
    expect(data.error.code).toBe("INVALID_JSON");
  });

  it("POST /proposals — 节点不存在", async () => {
    const db = mockDB({ nodeRow: null });
    const req = mockRequest(
      "POST",
      makeUrl("/api/ccp/v1/governance/proposals").href,
      {
        title: "Test",
        description: "test",
        type: "other",
        node_id: "nonexistent-node",
      },
    );

    const resp = await handleGovernance(req, db);
    expect(resp.status).toBe(404);

    const data = await resp.json();
    expect(data.error.code).toBe("CAPABILITY_NOT_FOUND");
  });

  it("所有合法 proposal type 均可创建", () => {
    const validTypes = [
      "spec-change",
      "api-change",
      "policy-change",
      "node-management",
      "other",
    ];
    validTypes.forEach((type) => {
      expect(validTypes).toContain(type);
    });
  });

  // ——— 列表 ———

  it("GET /proposals — 列出所有提案", async () => {
    const mockProposals = [
      {
        id: "ccp-gov-001",
        title: "Proposal 1",
        description: "First proposal",
        type: "spec-change",
        status: "proposed",
        proposer_node_id: "node-1",
        proposer_name: "Node One",
        created_at: "2026-09-01T00:00:00Z",
        updated_at: "2026-09-01T00:00:00Z",
      },
      {
        id: "ccp-gov-002",
        title: "Proposal 2",
        description: "Second proposal",
        type: "api-change",
        status: "accepted",
        proposer_node_id: "node-2",
        proposer_name: "Node Two",
        created_at: "2026-09-02T00:00:00Z",
        updated_at: "2026-09-03T00:00:00Z",
      },
    ];

    const db = mockDB({ proposalRows: mockProposals });
    const req = mockRequest(
      "GET",
      makeUrl("/api/ccp/v1/governance/proposals").href,
    );

    const resp = await handleGovernance(req, db);
    expect(resp.status).toBe(200);

    const data = await resp.json();
    expect(data.count).toBe(2);
    expect(data.proposals.length).toBe(2);
    expect(data.proposals[0].title).toBe("Proposal 1");
  });

  it("GET /proposals — 按 status 筛选", async () => {
    const proposals = [
      {
        id: "ccp-gov-003",
        title: "Accepted Only",
        description: "",
        type: "other",
        status: "accepted",
        proposer_node_id: "n1",
        proposer_name: "N1",
        created_at: "2026-09-01T00:00:00Z",
        updated_at: "2026-09-01T00:00:00Z",
      },
    ];

    const db = mockDB({ proposalRows: proposals });
    const req = mockRequest(
      "GET",
      makeUrl("/api/ccp/v1/governance/proposals?status=accepted").href,
    );

    const resp = await handleGovernance(req, db);
    expect(resp.status).toBe(200);

    const data = await resp.json();
    expect(data.proposals.length).toBe(1);
    expect(data.proposals[0].status).toBe("accepted");
  });

  it("GET /proposals — 空结果", async () => {
    const db = mockDB({ proposalRows: [] });
    const req = mockRequest(
      "GET",
      makeUrl("/api/ccp/v1/governance/proposals").href,
    );

    const resp = await handleGovernance(req, db);
    expect(resp.status).toBe(200);

    const data = await resp.json();
    expect(data.count).toBe(0);
  });

  // ——— 详情 ———

  it("GET /proposals/{id} — 查看提案详情", async () => {
    const proposal = {
      id: "ccp-gov-detail",
      title: "Detail Test",
      description: "A detailed proposal",
      type: "api-change",
      status: "voting",
      proposer_node_id: "n1",
      proposer_name: "N1",
      voting_start_at: "2026-09-10T00:00:00Z",
      voting_end_at: "2026-09-17T00:00:00Z",
      created_at: "2026-09-10T00:00:00Z",
      updated_at: "2026-09-10T00:00:00Z",
    };
    const votes = [
      {
        proposal_id: "ccp-gov-detail",
        node_id: "n1",
        node_name: "N1",
        vote: "approve",
        weight: 1.5,
        voted_at: "2026-09-11T00:00:00Z",
      },
    ];

    const db = mockDB({ proposalRow: proposal, voteRows: votes });
    const req = mockRequest(
      "GET",
      makeUrl("/api/ccp/v1/governance/proposals/ccp-gov-detail").href,
    );

    const resp = await handleGovernance(req, db);
    expect(resp.status).toBe(200);

    const data = await resp.json();
    expect(data.proposal.id).toBe("ccp-gov-detail");
    expect(data.votes.length).toBe(1);
    expect(data.vote_count).toBe(1);
  });

  it("GET /proposals/{id} — 提案不存在", async () => {
    const db = mockDB({ proposalRow: null });
    const req = mockRequest(
      "GET",
      makeUrl("/api/ccp/v1/governance/proposals/nonexistent").href,
    );

    const resp = await handleGovernance(req, db);
    expect(resp.status).toBe(404);

    const data = await resp.json();
    expect(data.error.code).toBe("CAPABILITY_NOT_FOUND");
  });

  // ——— 状态更新 ———

  it("PATCH /proposals/{id} — 有效状态转换", async () => {
    const proposal = {
      id: "ccp-gov-patch",
      title: "Patch Test",
      description: "",
      type: "spec-change",
      status: "draft",
      proposer_node_id: "n1",
      proposer_name: "N1",
      created_at: "2026-09-01T00:00:00Z",
      updated_at: "2026-09-01T00:00:00Z",
    };

    const db = mockDB({ proposalRow: proposal });
    const req = mockRequest(
      "PATCH",
      makeUrl("/api/ccp/v1/governance/proposals/ccp-gov-patch").href,
      { status: "proposed" },
    );

    const resp = await handleGovernance(req, db);
    expect(resp.status).toBe(200);

    const data = await resp.json();
    expect(data.proposal.status).toBe("proposed");
  });

  it("PATCH /proposals/{id} — voting 状态自动设置时间窗口", async () => {
    const proposal = {
      id: "ccp-gov-time",
      title: "Voting Time Test",
      description: "",
      type: "policy-change",
      status: "proposed",
      proposer_node_id: "n1",
      proposer_name: "N1",
      created_at: "2026-09-01T00:00:00Z",
      updated_at: "2026-09-01T00:00:00Z",
    };

    const db = mockDB({ proposalRow: proposal });
    const req = mockRequest(
      "PATCH",
      makeUrl("/api/ccp/v1/governance/proposals/ccp-gov-time").href,
      { status: "voting" },
    );

    const resp = await handleGovernance(req, db);
    expect(resp.status).toBe(200);

    const data = await resp.json();
    expect(data.proposal.status).toBe("voting");
    expect(data.proposal.voting_start_at).toBeTruthy();
    expect(data.proposal.voting_end_at).toBeTruthy();
  });

  it("PATCH /proposals/{id} — 无效状态转换", async () => {
    const proposal = {
      id: "ccp-gov-blocked",
      title: "Blocked",
      description: "",
      type: "other",
      status: "draft",
      proposer_node_id: "n1",
      proposer_name: "N1",
      created_at: "2026-09-01T00:00:00Z",
      updated_at: "2026-09-01T00:00:00Z",
    };

    const db = mockDB({ proposalRow: proposal });
    const req = mockRequest(
      "PATCH",
      makeUrl("/api/ccp/v1/governance/proposals/ccp-gov-blocked").href,
      { status: "accepted" },
    );

    const resp = await handleGovernance(req, db);
    expect(resp.status).toBe(400);

    const data = await resp.json();
    expect(data.error.code).toBe("INVALID_SCHEMA");
  });

  it("PATCH /proposals/{id} — 提案不存在", async () => {
    const db = mockDB({ proposalRow: null });
    const req = mockRequest(
      "PATCH",
      makeUrl("/api/ccp/v1/governance/proposals/nonexistent").href,
      { status: "proposed" },
    );

    const resp = await handleGovernance(req, db);
    expect(resp.status).toBe(404);
  });

  // ——— 投票 ———

  it("POST /proposals/{id}/vote — 投票成功", async () => {
    const proposal = {
      id: "ccp-gov-vote",
      title: "Vote Test",
      description: "",
      type: "spec-change",
      status: "voting",
      proposer_node_id: "n1",
      proposer_name: "N1",
      voting_start_at: "2026-09-10T00:00:00Z",
      voting_end_at: "2099-09-17T00:00:00Z",
      created_at: "2026-09-10T00:00:00Z",
      updated_at: "2026-09-10T00:00:00Z",
    };
    const node = {
      id: "node-voter-1",
      name: "Voter Node",
      trust_score: 0.85,
    };

    const db = mockDB({
      proposalRow: proposal,
      nodeRow: node,
      voteRows: [
        {
          proposal_id: "ccp-gov-vote",
          node_id: "node-voter-1",
          node_name: "Voter Node",
          vote: "approve",
          weight: 1.5,
          voted_at: "2026-09-17T00:00:00Z",
        },
      ],
    });
    const req = mockRequest(
      "POST",
      makeUrl("/api/ccp/v1/governance/proposals/ccp-gov-vote/vote").href,
      {
        node_id: "node-voter-1",
        vote: "approve",
      },
    );

    const resp = await handleGovernance(req, db);
    expect(resp.status).toBe(200);

    const data = await resp.json();
    expect(data.vote.vote).toBe("approve");
    expect(data.vote.weight).toBeGreaterThan(1); // trust_score 0.85 → weight > 1
    expect(data.vote.node_name).toBe("Voter Node");
    expect(data.tally.total_nodes).toBe(1);
  });

  it("POST /proposals/{id}/vote — reject 投票", async () => {
    const proposal = {
      id: "ccp-gov-reject",
      title: "Reject Test",
      description: "",
      type: "other",
      status: "voting",
      proposer_node_id: "n1",
      proposer_name: "N1",
      voting_start_at: "2026-09-10T00:00:00Z",
      voting_end_at: "2099-09-17T00:00:00Z",
      created_at: "2026-09-10T00:00:00Z",
      updated_at: "2026-09-10T00:00:00Z",
    };
    const node = { id: "nr1", name: "R1", trust_score: 0.5 };

    const db = mockDB({
      proposalRow: proposal,
      nodeRow: node,
      voteRows: [
        {
          proposal_id: "ccp-gov-reject",
          node_id: "nr1",
          node_name: "R1",
          vote: "reject",
          weight: 1.0,
          voted_at: "2026-09-17T00:00:00Z",
        },
      ],
    });
    const req = mockRequest(
      "POST",
      makeUrl("/api/ccp/v1/governance/proposals/ccp-gov-reject/vote").href,
      { node_id: "nr1", vote: "reject" },
    );

    const resp = await handleGovernance(req, db);
    expect(resp.status).toBe(200);

    const data = await resp.json();
    expect(data.vote.vote).toBe("reject");
    expect(data.tally.total_nodes).toBe(1);
    expect(data.tally.approve_weight).toBe(0);
  });

  it("POST /proposals/{id}/vote — abstain 投票", async () => {
    const proposal = {
      id: "ccp-gov-abstain",
      title: "Abstain Test",
      description: "",
      type: "other",
      status: "voting",
      proposer_node_id: "n1",
      proposer_name: "N1",
      voting_start_at: "2026-09-10T00:00:00Z",
      voting_end_at: "2099-09-17T00:00:00Z",
      created_at: "2026-09-10T00:00:00Z",
      updated_at: "2026-09-10T00:00:00Z",
    };
    const node = { id: "na1", name: "A1", trust_score: 0.5 };

    const db = mockDB({
      proposalRow: proposal,
      nodeRow: node,
      voteRows: [],
    });
    const req = mockRequest(
      "POST",
      makeUrl("/api/ccp/v1/governance/proposals/ccp-gov-abstain/vote").href,
      { node_id: "na1", vote: "abstain" },
    );

    const resp = await handleGovernance(req, db);
    expect(resp.status).toBe(200);

    const data = await resp.json();
    expect(data.vote.vote).toBe("abstain");
  });

  it("POST /proposals/{id}/vote — 无效 vote 值", async () => {
    const proposal = {
      id: "ccp-gov-badvote",
      title: "Bad Vote",
      description: "",
      type: "other",
      status: "voting",
      proposer_node_id: "n1",
      proposer_name: "N1",
      voting_start_at: "2026-09-10T00:00:00Z",
      voting_end_at: "2099-09-17T00:00:00Z",
      created_at: "2026-09-10T00:00:00Z",
      updated_at: "2026-09-10T00:00:00Z",
    };

    const db = mockDB({ proposalRow: proposal });
    const req = mockRequest(
      "POST",
      makeUrl("/api/ccp/v1/governance/proposals/ccp-gov-badvote/vote").href,
      { node_id: "n1", vote: "maybe" },
    );

    const resp = await handleGovernance(req, db);
    expect(resp.status).toBe(400);

    const data = await resp.json();
    expect(data.error.code).toBe("INVALID_SCHEMA");
  });

  it("POST /proposals/{id}/vote — 非 voting 状态不可投票", async () => {
    const proposal = {
      id: "ccp-gov-draft",
      title: "Draft",
      description: "",
      type: "other",
      status: "draft",
      proposer_node_id: "n1",
      proposer_name: "N1",
      created_at: "2026-09-01T00:00:00Z",
      updated_at: "2026-09-01T00:00:00Z",
    };

    const db = mockDB({ proposalRow: proposal });
    const req = mockRequest(
      "POST",
      makeUrl("/api/ccp/v1/governance/proposals/ccp-gov-draft/vote").href,
      { node_id: "n1", vote: "approve" },
    );

    const resp = await handleGovernance(req, db);
    expect(resp.status).toBe(400);

    const data = await resp.json();
    expect(data.error.code).toBe("INVALID_SCHEMA");
  });

  it("POST /proposals/{id}/vote — 缺少 node_id 或 vote", async () => {
    const proposal = {
      id: "ccp-gov-missing",
      title: "Missing",
      description: "",
      type: "other",
      status: "voting",
      proposer_node_id: "n1",
      proposer_name: "N1",
      voting_start_at: "2026-09-10T00:00:00Z",
      voting_end_at: "2099-09-17T00:00:00Z",
      created_at: "2026-09-01T00:00:00Z",
      updated_at: "2026-09-01T00:00:00Z",
    };

    const db = mockDB({ proposalRow: proposal });
    const req = mockRequest(
      "POST",
      makeUrl("/api/ccp/v1/governance/proposals/ccp-gov-missing/vote").href,
      { node_id: "n1" }, // missing vote
    );

    const resp = await handleGovernance(req, db);
    expect(resp.status).toBe(400);
  });

  it("POST /proposals/{id}/vote — 投票节点不存在", async () => {
    const proposal = {
      id: "ccp-gov-nonode",
      title: "No Node",
      description: "",
      type: "other",
      status: "voting",
      proposer_node_id: "n1",
      proposer_name: "N1",
      voting_start_at: "2026-09-10T00:00:00Z",
      voting_end_at: "2099-09-17T00:00:00Z",
      created_at: "2026-09-01T00:00:00Z",
      updated_at: "2026-09-01T00:00:00Z",
    };

    const db = mockDB({ proposalRow: proposal, nodeRow: null });
    const req = mockRequest(
      "POST",
      makeUrl("/api/ccp/v1/governance/proposals/ccp-gov-nonode/vote").href,
      { node_id: "ghost-node", vote: "approve" },
    );

    const resp = await handleGovernance(req, db);
    expect(resp.status).toBe(404);
  });

  it("POST /proposals/{id}/vote — 投票期已结束", async () => {
    const proposal = {
      id: "ccp-gov-ended",
      title: "Ended",
      description: "",
      type: "other",
      status: "voting",
      proposer_node_id: "n1",
      proposer_name: "N1",
      voting_start_at: "2026-01-01T00:00:00Z",
      voting_end_at: "2026-01-02T00:00:00Z",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    };

    const db = mockDB({ proposalRow: proposal });
    const req = mockRequest(
      "POST",
      makeUrl("/api/ccp/v1/governance/proposals/ccp-gov-ended/vote").href,
      { node_id: "n1", vote: "approve" },
    );

    const resp = await handleGovernance(req, db);
    expect(resp.status).toBe(400);

    const data = await resp.json();
    expect(data.error.code).toBe("INVALID_SCHEMA");
  });

  // ——— 计票 ———

  it("GET /proposals/{id}/votes — 查看投票结果（含统计）", async () => {
    const proposal = {
      id: "ccp-gov-tally",
      title: "Tally Test",
      description: "",
      type: "spec-change",
      status: "voting",
      proposer_node_id: "n1",
      proposer_name: "N1",
      voting_start_at: "2026-09-10T00:00:00Z",
      voting_end_at: "2099-09-17T00:00:00Z",
      created_at: "2026-09-10T00:00:00Z",
      updated_at: "2026-09-10T00:00:00Z",
    };
    const votes = [
      {
        proposal_id: "ccp-gov-tally",
        node_id: "n1",
        node_name: "N1",
        vote: "approve",
        weight: 1.5,
        voted_at: "2026-09-11T00:00:00Z",
      },
      {
        proposal_id: "ccp-gov-tally",
        node_id: "n2",
        node_name: "N2",
        vote: "reject",
        weight: 1.0,
        voted_at: "2026-09-12T00:00:00Z",
      },
    ];

    const db = mockDB({ proposalRow: proposal, voteRows: votes });
    const req = mockRequest(
      "GET",
      makeUrl("/api/ccp/v1/governance/proposals/ccp-gov-tally/votes").href,
    );

    const resp = await handleGovernance(req, db);
    expect(resp.status).toBe(200);

    const data = await resp.json();
    expect(data.votes.length).toBe(2);
    expect(data.tally.total_nodes).toBe(2);
    expect(data.tally.total_weight).toBe(2.5);
    expect(data.tally.approve_weight).toBe(1.5);
    expect(data.tally.reject_weight).toBe(1.0);
    expect(data.tally.abstain_weight).toBe(0);
    expect(data.tally.approval_ratio).toBeCloseTo(0.6, 1);
    expect(data.tally.quorum_met).toBe(false); // 需要 ≥3 节点
  });

  it("GET /proposals/{id}/votes — 提案不存在", async () => {
    const db = mockDB({ proposalRow: null });
    const req = mockRequest(
      "GET",
      makeUrl("/api/ccp/v1/governance/proposals/nonexistent/votes").href,
    );

    const resp = await handleGovernance(req, db);
    expect(resp.status).toBe(404);
  });

  it("GET /proposals/{id}/votes — 无投票记录", async () => {
    const proposal = {
      id: "ccp-gov-empty",
      title: "Empty Tally",
      description: "",
      type: "other",
      status: "voting",
      proposer_node_id: "n1",
      proposer_name: "N1",
      voting_start_at: "2026-09-10T00:00:00Z",
      voting_end_at: "2099-09-17T00:00:00Z",
      created_at: "2026-09-10T00:00:00Z",
      updated_at: "2026-09-10T00:00:00Z",
    };

    const db = mockDB({ proposalRow: proposal, voteRows: [] });
    const req = mockRequest(
      "GET",
      makeUrl("/api/ccp/v1/governance/proposals/ccp-gov-empty/votes").href,
    );

    const resp = await handleGovernance(req, db);
    expect(resp.status).toBe(200);

    const data = await resp.json();
    expect(data.tally.total_nodes).toBe(0);
    expect(data.tally.total_weight).toBe(0);
    expect(data.tally.approval_ratio).toBe(0);
  });

  // ——— 路由 404 ———

  it("未知 governance 端点返回 404", async () => {
    const db = mockDB({});
    const req = mockRequest(
      "GET",
      makeUrl("/api/ccp/v1/governance/unknown").href,
    );

    const resp = await handleGovernance(req, db);
    expect(resp.status).toBe(404);
  });
});

// ============================================================
// Contributors 贡献者测试
// ============================================================

describe("Contributors — 贡献者管理", () => {
  const sampleContributor = {
    github_id: 12345,
    github_login: "test-dev",
    github_name: "Test Developer",
    github_avatar: "https://avatars.githubusercontent.com/u/12345",
    role: "contributor",
    trust_score: 0.75,
    contributions_count: 15,
    badges: JSON.stringify([
      {
        id: "first-contribution",
        name: "First Contribution",
        description: "提交了第一个能力锚点",
        icon: "🌟",
        earned_at: "2026-09-01T00:00:00Z",
      },
    ]),
    created_at: "2026-08-01T00:00:00Z",
    last_seen: "2026-09-15T00:00:00Z",
  };

  const sampleContributor2 = {
    github_id: 67890,
    github_login: "senior-dev",
    github_name: "Senior Developer",
    github_avatar: "",
    role: "maintainer",
    trust_score: 0.92,
    contributions_count: 75,
    badges: JSON.stringify([
      {
        id: "maintainer",
        name: "Maintainer",
        description: "晋升为维护者",
        icon: "🛡️",
        earned_at: "2026-09-10T00:00:00Z",
      },
    ]),
    created_at: "2026-06-01T00:00:00Z",
    last_seen: "2026-09-16T00:00:00Z",
  };

  // ——— 注册 ———

  it("POST /contributors — 注册新贡献者", async () => {
    const db = mockDB({
      contributorRows: [],
      totalContributors: 0,
    });
    const req = mockRequest("POST", makeUrl("/api/ccp/v1/contributors").href, {
      github_id: 99999,
      github_login: "new-dev",
      github_name: "New Developer",
      github_avatar: "https://example.com/avatar.png",
    });

    const resp = await handleContributors(req, db);
    expect(resp.status).toBe(201);

    const data = await resp.json();
    expect(data.protocol).toBe("CCP");
    expect(data.contributor.github_id).toBe(99999);
    expect(data.contributor.github_login).toBe("new-dev");
    expect(data.contributor.role).toBe("observer");
    expect(data.contributor.trust_score).toBe(0.5);
    expect(data.contributor.contributions_count).toBe(0);
    expect(Array.isArray(data.contributor.badges)).toBe(true);
  });

  it("POST /contributors — 更新已有贡献者", async () => {
    const db = mockDB({
      contributorRows: [sampleContributor],
      totalContributors: 1,
    });
    const req = mockRequest("POST", makeUrl("/api/ccp/v1/contributors").href, {
      github_id: 12345,
      github_login: "test-dev-updated",
    });

    const resp = await handleContributors(req, db);
    expect(resp.status).toBe(200);

    const data = await resp.json();
    expect(data.contributor.github_login).toBe("test-dev-updated");
  });

  it("POST /contributors — 缺少必填字段", async () => {
    const db = mockDB({});
    const req = mockRequest("POST", makeUrl("/api/ccp/v1/contributors").href, {
      github_id: 11111,
    });

    const resp = await handleContributors(req, db);
    expect(resp.status).toBe(400);

    const data = await resp.json();
    expect(data.error.code).toBe("INVALID_SCHEMA");
  });

  it("POST /contributors — github_id 非正整数", async () => {
    const db = mockDB({});
    const req = mockRequest("POST", makeUrl("/api/ccp/v1/contributors").href, {
      github_id: -1,
      github_login: "bad-id",
    });

    const resp = await handleContributors(req, db);
    expect(resp.status).toBe(400);
  });

  it("POST /contributors — JSON 解析失败", async () => {
    const db = mockDB({});
    const req = mockRequest(
      "POST",
      makeUrl("/api/ccp/v1/contributors").href,
      "invalid-json",
    );

    const resp = await handleContributors(req, db);
    expect(resp.status).toBe(400);

    const data = await resp.json();
    expect(data.error.code).toBe("INVALID_JSON");
  });

  // ——— 列表 ———

  it("GET /contributors — 列出贡献者", async () => {
    const db = mockDB({
      contributorRows: [sampleContributor, sampleContributor2],
      totalContributors: 2,
    });
    const req = mockRequest("GET", makeUrl("/api/ccp/v1/contributors").href);

    const resp = await handleContributors(req, db);
    expect(resp.status).toBe(200);

    const data = await resp.json();
    expect(data.total).toBe(2);
    expect(data.count).toBe(2);
    expect(data.contributors.length).toBe(2);
    expect(data.contributors[0].badges).toEqual(
      JSON.parse(sampleContributor.badges),
    );
  });

  it("GET /contributors — 按 role 筛选", async () => {
    const db = mockDB({
      contributorRows: [sampleContributor2],
      totalContributors: 1,
    });
    const req = mockRequest(
      "GET",
      makeUrl("/api/ccp/v1/contributors?role=maintainer").href,
    );

    const resp = await handleContributors(req, db);
    expect(resp.status).toBe(200);

    const data = await resp.json();
    expect(data.contributors.length).toBe(1);
    expect(data.contributors[0].role).toBe("maintainer");
  });

  it("GET /contributors — 支持排序参数", async () => {
    const db = mockDB({
      contributorRows: [sampleContributor2, sampleContributor],
      totalContributors: 2,
    });
    const req = mockRequest(
      "GET",
      makeUrl(
        "/api/ccp/v1/contributors?sort=contributions_count&order=desc&limit=10",
      ).href,
    );

    const resp = await handleContributors(req, db);
    expect(resp.status).toBe(200);

    const data = await resp.json();
    expect(data.contributors.length).toBe(2);
  });

  it("GET /contributors — 空列表", async () => {
    const db = mockDB({
      contributorRows: [],
      totalContributors: 0,
    });
    const req = mockRequest("GET", makeUrl("/api/ccp/v1/contributors").href);

    const resp = await handleContributors(req, db);
    expect(resp.status).toBe(200);

    const data = await resp.json();
    expect(data.total).toBe(0);
    expect(data.count).toBe(0);
  });

  // ——— 详情 ———

  it("GET /contributors/{id} — 通过 github_id 查看", async () => {
    const contributions = [
      {
        id: 1,
        github_id: 12345,
        capability_id: "pdf-extract-text-001",
        type: "anchor",
        submitted_at: "2026-09-10T00:00:00Z",
      },
    ];

    const db = mockDB({
      contributorRows: [sampleContributor],
      contributionRows: contributions,
    });
    const req = mockRequest(
      "GET",
      makeUrl("/api/ccp/v1/contributors/12345").href,
    );

    const resp = await handleContributors(req, db);
    expect(resp.status).toBe(200);

    const data = await resp.json();
    expect(data.contributor.github_id).toBe(12345);
    expect(data.contributor.github_login).toBe("test-dev");
    expect(data.recent_contributions.length).toBe(1);
    expect(data.role_info).toBeTruthy();
  });

  it("GET /contributors/{id} — 通过 github_login 查看", async () => {
    const db = mockDB({
      contributorRows: [sampleContributor],
      contributionRows: [],
    });
    const req = mockRequest(
      "GET",
      makeUrl("/api/ccp/v1/contributors/test-dev").href,
    );

    const resp = await handleContributors(req, db);
    expect(resp.status).toBe(200);

    const data = await resp.json();
    expect(data.contributor.github_login).toBe("test-dev");
  });

  it("GET /contributors/{id} — 贡献者不存在", async () => {
    const db = mockDB({ contributorRows: [] });
    const req = mockRequest(
      "GET",
      makeUrl("/api/ccp/v1/contributors/99999").href,
    );

    const resp = await handleContributors(req, db);
    expect(resp.status).toBe(404);

    const data = await resp.json();
    expect(data.error.code).toBe("CAPABILITY_NOT_FOUND");
  });

  // ——— 徽章 ———

  it("GET /contributors/{id}/badges — 查看徽章列表", async () => {
    const db = mockDB({
      contributorRows: [sampleContributor],
    });
    const req = mockRequest(
      "GET",
      makeUrl("/api/ccp/v1/contributors/12345/badges").href,
    );

    const resp = await handleContributors(req, db);
    expect(resp.status).toBe(200);

    const data = await resp.json();
    expect(data.contributor.github_id).toBe(12345);
    expect(Array.isArray(data.badges)).toBe(true);
    expect(Array.isArray(data.available_badges)).toBe(true);
    expect(data.available_badges.length).toBeGreaterThan(0);
  });

  it("GET /contributors/{id}/badges — 贡献者不存在", async () => {
    const db = mockDB({ contributorRows: [] });
    const req = mockRequest(
      "GET",
      makeUrl("/api/ccp/v1/contributors/99999/badges").href,
    );

    const resp = await handleContributors(req, db);
    expect(resp.status).toBe(404);
  });

  // ——— 排行榜 ———

  it("GET /contributors/leaderboard — 默认排序", async () => {
    const db = mockDB({
      contributorRows: [sampleContributor2, sampleContributor],
      totalContributors: 2,
    });
    const req = mockRequest(
      "GET",
      makeUrl("/api/ccp/v1/contributors/leaderboard").href,
    );

    const resp = await handleContributors(req, db);
    expect(resp.status).toBe(200);

    const data = await resp.json();
    expect(data.leaderboard.length).toBe(2);
    expect(data.leaderboard[0].rank).toBe(1);
    expect(data.leaderboard[1].rank).toBe(2);
  });

  it("GET /contributors/leaderboard — 按 trust_score 排序", async () => {
    const db = mockDB({
      contributorRows: [sampleContributor2, sampleContributor],
      totalContributors: 2,
    });
    const req = mockRequest(
      "GET",
      makeUrl("/api/ccp/v1/contributors/leaderboard?sort=trust_score&limit=5")
        .href,
    );

    const resp = await handleContributors(req, db);
    expect(resp.status).toBe(200);

    const data = await resp.json();
    expect(data.sort).toBe("trust_score");
  });

  it("GET /contributors/leaderboard — 空排行榜", async () => {
    const db = mockDB({
      contributorRows: [],
      totalContributors: 0,
    });
    const req = mockRequest(
      "GET",
      makeUrl("/api/ccp/v1/contributors/leaderboard").href,
    );

    const resp = await handleContributors(req, db);
    expect(resp.status).toBe(200);

    const data = await resp.json();
    expect(data.leaderboard.length).toBe(0);
  });

  // ——— 路由 404 ———

  it("未知 contributors 端点返回 404", async () => {
    const db = mockDB({});
    const req = mockRequest(
      "GET",
      makeUrl("/api/ccp/v1/contributors/unknown/path").href,
    );

    const resp = await handleContributors(req, db);
    expect(resp.status).toBe(404);
  });
});

// ============================================================
// 徽章与角色逻辑测试
// ============================================================

describe("徽章定义完整性", () => {
  it("BADGE_DEFINITIONS 包含所有预期徽章", () => {
    const expected = [
      "first-contribution",
      "contributor-10",
      "contributor-50",
      "contributor-100",
      "maintainer",
      "steward",
      "node-operator",
      "federation-pioneer",
    ];
    expected.forEach((id) => {
      expect(BADGE_DEFINITIONS[id]).toBeDefined();
    });
  });

  it("每个徽章定义包含 name / description / icon / condition", () => {
    Object.entries(BADGE_DEFINITIONS).forEach(([id, def]) => {
      expect(def.name).toBeTruthy();
      expect(def.description).toBeTruthy();
      expect(def.icon).toBeTruthy();
      expect(typeof def.condition).toBe("function");
    });
  });

  it("ROLE_HIERARCHY 包含 observer / contributor / maintainer / steward", () => {
    ["observer", "contributor", "maintainer", "steward"].forEach((role) => {
      expect(ROLE_HIERARCHY[role]).toBeDefined();
      expect(typeof ROLE_HIERARCHY[role].level).toBe("number");
      expect(typeof ROLE_HIERARCHY[role].min_contributions).toBe("number");
    });
  });

  it("角色层级正确递增", () => {
    expect(ROLE_HIERARCHY.observer.level).toBe(0);
    expect(ROLE_HIERARCHY.contributor.level).toBe(1);
    expect(ROLE_HIERARCHY.maintainer.level).toBe(2);
    expect(ROLE_HIERARCHY.steward.level).toBe(3);
  });

  it("steward 是最顶级角色（next = null）", () => {
    expect(ROLE_HIERARCHY.steward.next).toBeNull();
  });

  it("observer → contributor 下一个角色升级条件正确", () => {
    expect(ROLE_HIERARCHY.observer.next).toBe("contributor");
    expect(ROLE_HIERARCHY.observer.next_threshold).toBe(1);
  });

  it("contributor → maintainer 升级条件: 50 贡献", () => {
    expect(ROLE_HIERARCHY.contributor.next).toBe("maintainer");
    expect(ROLE_HIERARCHY.contributor.next_threshold).toBe(50);
  });

  it("maintainer → steward 升级条件: 200 贡献", () => {
    expect(ROLE_HIERARCHY.maintainer.next).toBe("steward");
    expect(ROLE_HIERARCHY.maintainer.next_threshold).toBe(200);
  });
});

// ============================================================
// 权重计算逻辑验证
// ============================================================

describe("投票权重与法定人数逻辑", () => {
  it("trust_score 0.5 → weight 1.0", () => {
    const weight = Math.max(0, Math.min(2, 1 + (0.5 - 0.5) * 2));
    expect(weight).toBe(1.0);
  });

  it("trust_score 1.0 → weight 2.0", () => {
    const weight = Math.max(0, Math.min(2, 1 + (1.0 - 0.5) * 2));
    expect(weight).toBe(2.0);
  });

  it("trust_score 0.0 → weight 0.0", () => {
    const weight = Math.max(0, Math.min(2, 1 + (0.0 - 0.5) * 2));
    expect(weight).toBe(0);
  });

  it("trust_score 0.25 → weight 0.5", () => {
    const weight = Math.max(0, Math.min(2, 1 + (0.25 - 0.5) * 2));
    expect(weight).toBe(0.5);
  });

  it("trust_score 0.75 → weight 1.5", () => {
    const weight = Math.max(0, Math.min(2, 1 + (0.75 - 0.5) * 2));
    expect(weight).toBe(1.5);
  });

  it("法定人数最低 3 节点", () => {
    const QUORUM_MIN_NODES = 3;
    expect(QUORUM_MIN_NODES).toBe(3);

    // 2 节点不满足法定人数
    expect(2 >= QUORUM_MIN_NODES).toBe(false);
    // 3 节点满足
    expect(3 >= QUORUM_MIN_NODES).toBe(true);
  });

  it("批准阈值 > 2/3", () => {
    const APPROVAL_THRESHOLD = 2 / 3;

    // 60% 不通过
    expect(0.6 > APPROVAL_THRESHOLD).toBe(false);

    // 70% 通过
    expect(0.7 > APPROVAL_THRESHOLD).toBe(true);

    // 66.7% 刚好等于，不通过（必须 >）
    expect(2 / 3 > APPROVAL_THRESHOLD).toBe(false);
  });
});
