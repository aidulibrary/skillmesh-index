/**
 * CCP 协议 v1.0.0 — 路由分发器
 * ==============================
 * SkillMesh / 插台 能力通约协议 API 端点。
 *
 * 端点映射：
 *   GET  /api/ccp/v1/capabilities              → 能力列表
 *   GET  /api/ccp/v1/capabilities/{id}         → 能力详情
 *   GET  /api/ccp/v1/capabilities/{id}/adapters/{framework} → 适配器
 *   GET  /api/ccp/v1/search?q={keyword}[&federated=true] → 搜索
 *   GET  /api/ccp/v1/metrics                   → 请求监控
 *   GET  /api/ccp/v1/federation                → 本节点信息
 *   GET  /api/ccp/v1/federation/nodes          → 联邦节点列表
 *   POST /api/ccp/v1/telemetry                 → 遥测回传
 *   POST /api/ccp/v1/contribute                → 社区贡献
 *   POST /api/ccp/v1/federation/nodes          → 注册联邦节点
 *   POST /api/ccp/v1/federation/exchange       → 索引摘要交换
 *
 * 模块结构：
 *   handlers/    → 业务逻辑处理器
 *   lib/         → 共享库（D1查询、缓存、信任向量、校验、响应、监控、语义搜索）
 *   federation/  → 联邦化协议（节点管理、索引交换）
 *
 * 版本：v1.0.0（冻结）
 * 协议：CCP (Capability Commensurability Protocol)
 */

import { getDB, queryOne, findCapStatic } from "./lib/db.js";
import { generateAdapter } from "./handlers/adapters.js";
import {
  handleList,
  handleDetail,
  handleSearch,
} from "./handlers/capabilities.js";
import { handleTelemetry } from "./handlers/telemetry.js";
import { handleContribute } from "./handlers/contribute.js";
import { jsonResponse, yamlResponse, corsResponse } from "./lib/response.js";
import { structuredError } from "./lib/errors.js";
import { safeErrorResponse } from "./lib/error-boundary.js";
import { recordRequest, getMetrics } from "./lib/monitoring.js";
import {
  getNodeInfo,
  listNodes,
  addNode,
  removeNode,
} from "./federation/node.js";
import { handleExchange } from "./federation/exchange.js";
import { handleGovernance } from "./handlers/governance.js";
import { handleContributors } from "./handlers/contributors.js";
import { handleHealth } from "./handlers/health.js";

const CCP_VERSION = "v1.0.0";

export async function onRequest(context) {
  try {
    const { request, env } = context;
    const url = new URL(request.url);
    const path = url.pathname;
    const db = getDB(env);
    const startTime = Date.now();

    const prefix = "/api/ccp/v1/";
    let relative = path.startsWith(prefix) ? path.slice(prefix.length) : "";

    if (relative.startsWith("capabilities/")) {
      relative = relative.slice("capabilities/".length);
    }

    if (request.method === "OPTIONS") {
      return corsResponse();
    }

    let response;

    if (request.method === "POST") {
      if (relative === "telemetry") {
        response = await handleTelemetry(request, db, env);
      } else if (relative === "contribute") {
        response = await handleContribute(request, db, env);
      } else if (relative === "federation/exchange") {
        response = await handleExchange(request, db, env);
      } else if (relative === "federation/nodes") {
        try {
          const body = await request.json();
          const node = await addNode(db, body);
          response = jsonResponse({ accepted: true, node });
        } catch (e) {
          response = structuredError("VALIDATION_ERROR", {
            detail: { cause: e.message },
          });
        }
      } else if (relative.startsWith("governance")) {
        response = await handleGovernance(request, db);
      } else if (relative.startsWith("contributors")) {
        response = await handleContributors(request, db);
      } else {
        response = structuredError("METHOD_NOT_ALLOWED");
      }
    } else if (request.method === "DELETE") {
      if (relative.startsWith("federation/nodes/")) {
        const nodeId = relative.slice("federation/nodes/".length);
        try {
          await removeNode(db, nodeId);
          response = jsonResponse({ deleted: true, node_id: nodeId });
        } catch (e) {
          response = structuredError("VALIDATION_ERROR", {
            detail: { cause: e.message },
          });
        }
      } else {
        response = structuredError("METHOD_NOT_ALLOWED");
      }
    } else if (request.method === "PATCH") {
      if (relative.startsWith("governance")) {
        response = await handleGovernance(request, db);
      } else {
        response = structuredError("METHOD_NOT_ALLOWED");
      }
    } else if (request.method !== "GET") {
      response = structuredError("METHOD_NOT_ALLOWED");
    } else if (relative === "metrics") {
      response = jsonResponse(getMetrics());
    } else if (relative === "search" || relative.startsWith("search?")) {
      const q = url.searchParams.get("q") || "";
      const federated = url.searchParams.get("federated") === "true";
      response = await handleSearch(db, env, q, federated);
    } else if (relative === "federation" || relative === "federation/node") {
      response = jsonResponse(getNodeInfo(env));
    } else if (relative === "federation/nodes") {
      const nodes = await listNodes(db);
      response = jsonResponse({ nodes, count: nodes.length });
    } else if (relative.startsWith("governance")) {
      response = await handleGovernance(request, db);
    } else if (relative.startsWith("badge/")) {
      const badgePath = relative.slice("badge/".length);
      const [contributorId, badgeFile] = badgePath.split("/");
      const badgeId = badgeFile?.replace(".svg", "");
      const contributor = await db
        .prepare("SELECT * FROM contributors WHERE github_id = ?")
        .bind(Number(contributorId))
        .first();
      if (!contributor) {
        response = structuredError("CAPABILITY_NOT_FOUND", {
          detail: { reason: `Contributor ${contributorId} not found` },
        });
      } else {
        const badges = JSON.parse(contributor.badges || "[]");
        const badge = badges.find((b) => b.id === badgeId);
        if (!badge) {
          response = structuredError("CAPABILITY_NOT_FOUND", {
            detail: { reason: `Badge ${badgeId} not earned` },
          });
        } else {
          const icon = badge.icon || "?";
          const name = badge.name || badgeId;
          const totalWidth = 20 + name.length * 7 + 14;
          const svg = `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="20" viewBox="0 0 ${totalWidth} 20"><linearGradient id="bg" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="#4F46E5"/><stop offset="100%" stop-color="#7C3AED"/></linearGradient><rect width="${totalWidth}" height="20" rx="3" fill="url(#bg)"/><rect x="20" width="1" height="20" fill="rgba(255,255,255,0.2)"/><text x="10" y="14" text-anchor="middle" font-size="12" fill="white">${icon}</text><text x="26" y="14" font-size="11" fill="white" font-family="Arial,sans-serif">${name}</text></svg>`;
          response = new Response(svg, {
            headers: {
              "Content-Type": "image/svg+xml",
              "Cache-Control": "public, max-age=86400",
            },
          });
        }
      }
    } else if (relative.startsWith("contributors")) {
      response = await handleContributors(request, db);
    } else if (relative.startsWith("health")) {
      response = await handleHealth(request, db);
    } else if (!relative || relative === "capabilities") {
      response = await handleList(db, env);
    } else {
      const parts = relative.split("/");
      const capId = parts[0];

      if (parts.length === 1) {
        response = await handleDetail(db, env, capId);
      } else if (parts.length === 2 && parts[1] === "versions") {
        // S9-7：版本历史路由
        let versions = [];
        if (db) {
          try {
            const { results } = await db
              .prepare(
                "SELECT * FROM capability_versions WHERE cap_id = ? ORDER BY version DESC",
              )
              .bind(parts[0])
              .all();
            versions = results || [];
          } catch (_) {}
        }
        response = jsonResponse({
          protocol: "CCP",
          version: CCP_VERSION,
          capability_id: parts[0],
          versions,
          count: versions.length,
        });
      } else if (parts[1] === "adapters" && parts[2]) {
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
          response = structuredError("CAPABILITY_NOT_FOUND", {
            detail: { id: capId },
          });
        } else {
          const result = generateAdapter(cap, parts[2]);
          if (!result) {
            response = structuredError("VALIDATION_ERROR", {
              detail: {
                framework: parts[2],
                supported: ["dsh", "mcp", "langchain", "crewai", "dify"],
              },
            });
          } else if (result.type === "yaml") {
            response = yamlResponse(result.content);
          } else {
            response = jsonResponse(JSON.parse(result.content));
          }
        }
      } else {
        response = structuredError("CAPABILITY_NOT_FOUND", {
          detail: { path: relative },
        });
      }
    }

    const latency = Date.now() - startTime;
    recordRequest(relative || "list", latency, response.status);
    return response;
  } catch (err) {
    return safeErrorResponse(err, "ccp/v1");
  }
}
