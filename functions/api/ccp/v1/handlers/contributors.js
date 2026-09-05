/**
 * 社区贡献者体系 API 处理器
 * ==========================
 * CCP 贡献者身份管理 — 注册、查询、徽章、信任注入。
 *
 * 端点：
 *   POST   /api/ccp/v1/contributors         注册/更新贡献者
 *   GET    /api/ccp/v1/contributors         列出贡献者
 *   GET    /api/ccp/v1/contributors/{id}    查看贡献者详情
 *   GET    /api/ccp/v1/contributors/{id}/badges  查看贡献者徽章
 *   GET    /badge/{contributorId}/{badgeId}.svg   徽章图片
 *
 * 版本：v1.0
 * 协议：CCP v1.0.0
 */

import { jsonResponse } from "../lib/response.js";
import { structuredError } from "../lib/errors.js";

const CCP_VERSION = "v1.0.0";

/**
 * 角色层级与升级条件
 */
const ROLE_HIERARCHY = {
  observer: {
    level: 0,
    min_contributions: 0,
    next: "contributor",
    next_threshold: 1,
  },
  contributor: {
    level: 1,
    min_contributions: 1,
    next: "maintainer",
    next_threshold: 50,
  },
  maintainer: {
    level: 2,
    min_contributions: 50,
    next: "steward",
    next_threshold: 200,
  },
  steward: {
    level: 3,
    min_contributions: 200,
    next: null,
    next_threshold: null,
  },
};

/**
 * 徽章定义
 */
const BADGE_DEFINITIONS = {
  "first-contribution": {
    name: "First Contribution",
    description: "提交了第一个能力锚点",
    icon: "🌟",
    condition: (count) => count >= 1,
  },
  "contributor-10": {
    name: "10 Contributions",
    description: "贡献了 10 个能力锚点",
    icon: "⭐",
    condition: (count) => count >= 10,
  },
  "contributor-50": {
    name: "50 Contributions",
    description: "贡献了 50 个能力锚点",
    icon: "💫",
    condition: (count) => count >= 50,
  },
  "contributor-100": {
    name: "100 Contributions",
    description: "贡献了 100 个能力锚点",
    icon: "🌟",
    condition: (count) => count >= 100,
  },
  maintainer: {
    name: "Maintainer",
    description: "晋升为维护者",
    icon: "🛡️",
    condition: (role) => role === "maintainer" || role === "steward",
  },
  steward: {
    name: "Steward",
    description: "晋升为协议管家",
    icon: "👑",
    condition: (role) => role === "steward",
  },
  "node-operator": {
    name: "Node Operator",
    description: "运营一个联邦节点",
    icon: "🌐",
    condition: (nodeId) => !!nodeId,
  },
  "federation-pioneer": {
    name: "Federation Pioneer",
    description: "首批 3 个联邦节点运营者",
    icon: "🚀",
    condition: (badges) => badges?.includes("node-operator"),
  },
};

/**
 * 根据贡献数确定角色
 */
function computeRole(contributionsCount) {
  if (contributionsCount >= 200) return "steward";
  if (contributionsCount >= 50) return "maintainer";
  if (contributionsCount >= 1) return "contributor";
  return "observer";
}

/**
 * 计算应获得的徽章列表
 */
function computeBadges(contributor) {
  const badges = [];
  const count = contributor.contributions_count || 0;
  const role = contributor.role || "observer";
  const nodeId = contributor.node_id;

  for (const [badgeId, def] of Object.entries(BADGE_DEFINITIONS)) {
    let earned = false;
    if (badgeId === "node-operator") earned = def.condition(nodeId);
    else if (badgeId === "federation-pioneer")
      earned = def.condition(contributor.badges);
    else if (badgeId === "maintainer" || badgeId === "steward")
      earned = def.condition(role);
    else earned = def.condition(count);

    if (earned) {
      badges.push({
        id: badgeId,
        name: def.name,
        description: def.description,
        icon: def.icon,
        earned_at:
          contributor.badges?.find((b) => b.id === badgeId)?.earned_at ||
          new Date().toISOString(),
      });
    }
  }

  return badges;
}

/**
 * 生成 SVG 徽章
 */
function generateBadgeSVG(badgeId, badgeName, icon) {
  const width = 120;
  const height = 20;
  const iconWidth = 20;
  const textX = iconWidth + 6;
  const textWidth = badgeName.length * 7 + 10;
  const totalWidth = iconWidth + textWidth + 4;

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="${height}" viewBox="0 0 ${totalWidth} ${height}">`,
    `<linearGradient id="bg" x1="0" y1="0" x2="1" y2="0">`,
    `<stop offset="0%" stop-color="#4F46E5"/>`,
    `<stop offset="100%" stop-color="#7C3AED"/>`,
    `</linearGradient>`,
    `<rect width="${totalWidth}" height="${height}" rx="3" fill="url(#bg)"/>`,
    `<rect x="${iconWidth}" width="1" height="${height}" fill="rgba(255,255,255,0.2)"/>`,
    `<text x="${iconWidth / 2}" y="14" text-anchor="middle" font-size="12" fill="white">${icon}</text>`,
    `<text x="${textX}" y="14" font-size="11" fill="white" font-family="Arial,sans-serif">${badgeName}</text>`,
    `</svg>`,
  ].join("\n");
}

/**
 * 注册/更新贡献者
 */
async function registerContributor(request, db) {
  let body;
  try {
    body = await request.json();
  } catch (_) {
    return structuredError("INVALID_JSON");
  }

  const { github_id, github_login } = body;

  if (!github_id || !github_login) {
    return structuredError("INVALID_SCHEMA", {
      detail: { errors: ["github_id and github_login are required"] },
    });
  }

  const existing = await db
    .prepare("SELECT * FROM contributors WHERE github_id = ?")
    .bind(github_id)
    .first();

  const now = new Date().toISOString();
  const role = computeRole(existing ? existing.contributions_count : 0);

  if (existing) {
    const badges = computeBadges(existing);
    await db
      .prepare(
        `UPDATE contributors
         SET github_login = ?, github_name = COALESCE(?, github_name),
             github_avatar = COALESCE(?, github_avatar),
             role = ?, last_seen = ?, badges = ?
         WHERE github_id = ?`,
      )
      .bind(
        body.github_login || existing.github_login,
        body.github_name || null,
        body.github_avatar || null,
        role,
        now,
        JSON.stringify(badges),
        github_id,
      )
      .run();

    return jsonResponse({
      protocol: "CCP",
      version: CCP_VERSION,
      contributor: {
        ...existing,
        github_login: body.github_login || existing.github_login,
        github_name: body.github_name || existing.github_name,
        github_avatar: body.github_avatar || existing.github_avatar,
        role,
        badges,
        last_seen: now,
      },
    });
  }

  const badges = computeBadges({ contributions_count: 0, role: "observer" });
  await db
    .prepare(
      `INSERT INTO contributors
       (github_id, github_login, github_name, github_avatar, role, trust_score, contributions_count, badges, joined_at, last_seen)
       VALUES (?, ?, ?, ?, ?, 0.5, 0, ?, ?, ?)`,
    )
    .bind(
      github_id,
      github_login,
      body.github_name || "",
      body.github_avatar || "",
      "observer",
      JSON.stringify(badges),
      now,
      now,
    )
    .run();

  return jsonResponse(
    {
      protocol: "CCP",
      version: CCP_VERSION,
      contributor: {
        github_id,
        github_login,
        github_name: body.github_name || "",
        github_avatar: body.github_avatar || "",
        role: "observer",
        trust_score: 0.5,
        contributions_count: 0,
        badges,
        joined_at: now,
        last_seen: now,
      },
    },
    201,
  );
}

/**
 * 列出贡献者
 */
async function listContributors(url, db) {
  const role = url.searchParams.get("role");
  const sort = url.searchParams.get("sort") || "contributions_count";
  const order = url.searchParams.get("order") || "desc";
  const limit = Math.min(parseInt(url.searchParams.get("limit")) || 50, 200);
  const offset = parseInt(url.searchParams.get("offset")) || 0;

  let query = "SELECT * FROM contributors WHERE 1=1";
  const params = [];

  if (role) {
    query += " AND role = ?";
    params.push(role);
  }

  const validSort = [
    "contributions_count",
    "trust_score",
    "joined_at",
    "last_seen",
  ];
  const sortField = validSort.includes(sort) ? sort : "contributions_count";
  const sortOrder = order === "asc" ? "ASC" : "DESC";

  query += ` ORDER BY ${sortField} ${sortOrder} LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  const { results } = await db
    .prepare(query)
    .bind(...params)
    .all();

  const countResult = await db
    .prepare("SELECT COUNT(*) as total FROM contributors")
    .first();

  return jsonResponse({
    protocol: "CCP",
    version: CCP_VERSION,
    total: countResult?.total || 0,
    count: results?.length || 0,
    contributors: (results || []).map((c) => ({
      ...c,
      badges: typeof c.badges === "string" ? JSON.parse(c.badges) : c.badges,
    })),
  });
}

/**
 * 查看贡献者详情
 */
async function getContributor(contributorId, db) {
  const contributor = await db
    .prepare(
      "SELECT * FROM contributors WHERE github_id = ? OR github_login = ?",
    )
    .bind(contributorId, contributorId)
    .first();

  if (!contributor) {
    return structuredError("CAPABILITY_NOT_FOUND", {
      detail: { reason: `Contributor ${contributorId} not found` },
    });
  }

  const { results: contributions } = await db
    .prepare(
      "SELECT * FROM contribution_records WHERE github_id = ? ORDER BY created_at DESC LIMIT 50",
    )
    .bind(contributor.github_id)
    .all();

  return jsonResponse({
    protocol: "CCP",
    version: CCP_VERSION,
    contributor: {
      ...contributor,
      badges:
        typeof contributor.badges === "string"
          ? JSON.parse(contributor.badges)
          : contributor.badges,
    },
    recent_contributions: contributions || [],
    role_info: ROLE_HIERARCHY[contributor.role] || null,
  });
}

/**
 * 查看贡献者徽章
 */
async function getContributorBadges(contributorId, db) {
  const contributor = await db
    .prepare(
      "SELECT * FROM contributors WHERE github_id = ? OR github_login = ?",
    )
    .bind(contributorId, contributorId)
    .first();

  if (!contributor) {
    return structuredError("CAPABILITY_NOT_FOUND", {
      detail: { reason: `Contributor ${contributorId} not found` },
    });
  }

  const badges =
    typeof contributor.badges === "string"
      ? JSON.parse(contributor.badges)
      : contributor.badges;

  return jsonResponse({
    protocol: "CCP",
    version: CCP_VERSION,
    contributor: {
      github_id: contributor.github_id,
      github_login: contributor.github_login,
    },
    badges: badges || [],
    available_badges: Object.entries(BADGE_DEFINITIONS).map(([id, def]) => ({
      id,
      name: def.name,
      description: def.description,
      icon: def.icon,
    })),
  });
}

/**
 * 生成徽章 SVG
 */
function getBadgeSVG(badgeId) {
  const def = BADGE_DEFINITIONS[badgeId];
  if (!def) {
    return new Response("Badge not found", { status: 404 });
  }
  const svg = generateBadgeSVG(badgeId, def.name, def.icon);
  return new Response(svg, {
    status: 200,
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=86400",
    },
  });
}

/**
 * 主路由
 */
export async function handleContributors(request, db) {
  const url = new URL(request.url);
  const path = url.pathname;

  const badgeMatch = path.match(/^\/badge\/([^/]+)\.svg$/);
  if (badgeMatch) {
    return getBadgeSVG(badgeMatch[1]);
  }

  const apiPath = path.replace("/api/ccp/v1/contributors", "");

  if (apiPath === "" || apiPath === "/") {
    if (request.method === "POST") return registerContributor(request, db);
    if (request.method === "GET") return listContributors(url, db);
  }

  const detailMatch = apiPath.match(/^\/([^/]+)$/);
  if (detailMatch) {
    return getContributor(detailMatch[1], db);
  }

  const badgesMatch = apiPath.match(/^\/([^/]+)\/badges$/);
  if (badgesMatch) {
    return getContributorBadges(badgesMatch[1], db);
  }

  return structuredError("CAPABILITY_NOT_FOUND", {
    detail: { reason: "Contributors endpoint not found" },
  });
}

export default { handleContributors, BADGE_DEFINITIONS, ROLE_HIERARCHY };
