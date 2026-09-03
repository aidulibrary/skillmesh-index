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
import {
  jsonResponse,
  yamlResponse,
  corsResponse,
} from "./lib/response.js";
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
    } else if (!relative || relative === "capabilities") {
      response = await handleList(db, env);
    } else {
      const parts = relative.split("/");
      const capId = parts[0];

      if (parts.length === 1) {
        response = await handleDetail(db, env, capId);
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
