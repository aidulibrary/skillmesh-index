#!/usr/bin/env node

/**
 * SkillMesh Connect — CCP → DeepSeek-Harness 本地连接器
 * ==========================================================
 *
 * 启动本地 HTTP 服务，将 SkillMesh CCP 能力注册表生成 DSH catalog 格式，
 * 供 DeepSeek-Harness 通过 `dsh market add` 接入。
 *
 * 用法：
 *   npx skillmesh-connect
 *   npx skillmesh-connect --port 9999 --host https://skillmesh.pages.dev
 *
 * Harness 接入命令：
 *   dsh market add http://localhost:9999/catalog.json
 *
 * 端点：
 *   GET /catalog.json    DSH catalog（含全部能力）
 *   GET /dsh/{id}.yaml    单项 DSH plugin.yaml（代理 SkillMesh API）
 *   GET /health           健康检查
 *
 * 版本：v1.0.0
 */

import { createServer } from "node:http";
import { request as httpsRequest } from "node:https";
import { request as httpRequest } from "node:http";

// ============================================================
// 配置（命令行参数 + 默认值）
// ============================================================

const args = process.argv.slice(2);
function flag(name, fallback) {
  const idx = args.indexOf(`--${name}`);
  if (idx !== -1 && idx + 1 < args.length) return args[idx + 1];
  const eq = args.find((a) => a.startsWith(`--${name}=`));
  if (eq) return eq.slice(name.length + 3);
  return fallback;
}

const HOST = flag("host", "https://skillmesh.pages.dev");
const PORT = parseInt(flag("port", "9999"), 10);
const REFRESH_SEC = Math.max(10, parseInt(flag("refresh", "300"), 10));

const API_BASE = HOST.replace(/\/$/, "") + "/api/ccp/v1";

// ============================================================
// Catalog 缓存
// ============================================================

let catalogCache = null;
let lastFetchTime = 0;
let fetchError = null;

function catalogAge() {
  return Math.floor((Date.now() - lastFetchTime) / 1000);
}

// ============================================================
// HTTP fetch（零依赖，纯 Node.js 内置）
// ============================================================

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const transport = u.protocol === "https:" ? httpsRequest : httpRequest;
    const req = transport(
      u,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          "User-Agent": "SkillMesh-Connect/1.0.0",
        },
        timeout: 15000,
      },
      (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => {
          if (res.statusCode >= 400) {
            reject(
              new Error(
                `HTTP ${res.statusCode} from ${u.hostname}: ${body.slice(0, 200)}`,
              ),
            );
            return;
          }
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            reject(new Error(`Invalid JSON from ${u.hostname}: ${e.message}`));
          }
        });
      },
    );
    req.on("error", (e) => reject(e));
    req.on("timeout", () => {
      req.destroy();
      reject(new Error(`Request to ${u.hostname} timed out`));
    });
    req.end();
  });
}

function fetchText(url) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const transport = u.protocol === "https:" ? httpsRequest : httpRequest;
    const req = transport(
      u,
      {
        method: "GET",
        headers: {
          Accept: "application/x-yaml, text/plain, */*",
          "User-Agent": "SkillMesh-Connect/1.0.0",
        },
        timeout: 10000,
      },
      (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => {
          if (res.statusCode >= 400) {
            reject(new Error(`HTTP ${res.statusCode} from ${u.hostname}`));
            return;
          }
          resolve(body);
        });
      },
    );
    req.on("error", (e) => reject(e));
    req.on("timeout", () => {
      req.destroy();
      reject(new Error(`Request to ${u.hostname} timed out`));
    });
    req.end();
  });
}

// ============================================================
// 能力数据拉取
// ============================================================

async function fetchCapabilities() {
  const url = `${API_BASE}/capabilities`;
  const data = await fetchJSON(url);

  if (data.capabilities) return data.capabilities;
  if (data.results) return data.results;
  if (Array.isArray(data)) return data;

  throw new Error(
    `Unexpected response format from ${url}: ${JSON.stringify(Object.keys(data))}`,
  );
}

// ============================================================
// Catalog 生成（CCP → DSH catalog format）
// ============================================================

function buildCatalog(capabilities) {
  const entries = capabilities.map((cap) => {
    const id = cap.id;
    const safeId = id.replace(/_/g, "-");
    const trustScore = cap.trust_source || cap.trust_score || 0.5;

    return {
      name: safeId,
      version: String(cap.version || "1.0.0"),
      type: "skill",
      description: `${cap.name} — ${cap.name_en || ""}`
        .trim()
        .replace(/ — $/, ""),
      source: `${HOST.replace(/\/$/, "")}/api/ccp/${cap.id}/dsh.yaml`,
      homepage: cap.provenance || HOST,
      tags: (cap.features || []).slice(0, 8),
      category: cap.category || "general",
      trust: {
        score:
          typeof trustScore === "number"
            ? trustScore
            : parseFloat(trustScore) || 0.5,
        evidence: cap.evidence_count || 0,
        uncertainty: cap.evidence_uncertainty ?? null,
      },
    };
  });

  return {
    apiVersion: "v1",
    kind: "Catalog",
    metadata: {
      name: "skillmesh",
      version: "1.0.0",
      description: "SkillMesh CCP 能力注册表 — 跨协议能力发现与信任网络",
      homepage: HOST,
      generated: new Date().toISOString(),
      total: entries.length,
    },
    entries,
  };
}

// ============================================================
// Catalog 刷新
// ============================================================

async function refreshCatalog(force = false) {
  if (!force && catalogCache && catalogAge() < REFRESH_SEC) {
    return;
  }

  try {
    const caps = await fetchCapabilities();
    catalogCache = buildCatalog(caps);
    lastFetchTime = Date.now();
    fetchError = null;
    console.log(
      `[SkillMesh Connect] Catalog 已刷新 — ${catalogCache.metadata.total} 项能力 (${new Date().toLocaleTimeString()})`,
    );
  } catch (e) {
    fetchError = e.message;
    console.error(`[SkillMesh Connect] Catalog 拉取失败: ${e.message}`);
    if (!catalogCache) {
      catalogCache = buildCatalog([]);
      lastFetchTime = Date.now();
    }
  }
}

// ============================================================
// HTTP 服务器
// ============================================================

function jsonResponse(res, data, status = 200) {
  const body = JSON.stringify(data, null, 2);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

function textResponse(res, body, contentType, status = 200) {
  res.writeHead(status, {
    "Content-Type": `${contentType}; charset=utf-8`,
    "Access-Control-Allow-Origin": "*",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname;

  // OPTIONS — CORS 预检
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    res.end();
    return;
  }

  // 仅支持 GET
  if (req.method !== "GET") {
    jsonResponse(res, { error: "Method Not Allowed" }, 405);
    return;
  }

  // ——— /health ———
  if (path === "/health") {
    jsonResponse(res, {
      status: "ok",
      service: "skillmesh-connect",
      version: "1.0.0",
      upstream: HOST,
      catalog_total: catalogCache?.metadata?.total || 0,
      catalog_age_sec: catalogAge(),
      last_error: fetchError,
    });
    return;
  }

  // ——— /catalog.json ———
  if (path === "/catalog.json" || path === "/catalog") {
    await refreshCatalog();
    if (!catalogCache) {
      jsonResponse(res, { error: "Catalog unavailable" }, 503);
      return;
    }
    jsonResponse(res, catalogCache);
    return;
  }

  // ——— /dsh/{id}.yaml ———
  const dshMatch = path.match(/^\/dsh\/([^/]+)\.yaml$/);
  if (dshMatch) {
    const capId = dshMatch[1];
    const sourceUrl = `${HOST.replace(/\/$/, "")}/api/ccp/${capId}/dsh.yaml`;
    try {
      const yaml = await fetchText(sourceUrl);
      textResponse(res, yaml, "application/x-yaml");
    } catch (e) {
      jsonResponse(
        res,
        { error: "DSH adapter unavailable", cap_id: capId, detail: e.message },
        502,
      );
    }
    return;
  }

  // ——— 404 ———
  jsonResponse(res, { error: "Not Found" }, 404);
});

// ============================================================
// 启动
// ============================================================

async function main() {
  // 首次拉取 catalog
  await refreshCatalog(true);

  // 启动服务器
  server.listen(PORT, () => {
    console.log("");
    console.log("╔══════════════════════════════════════════════════════╗");
    console.log("║         SkillMesh Connect v1.0.0                      ║");
    console.log("║  CCP → DeepSeek-Harness 本地连接器                     ║");
    console.log("╠══════════════════════════════════════════════════════╣");
    console.log(
      `║  Local:  http://localhost:${PORT}                      ${" ".repeat(Math.max(0, 22 - String(PORT).length))}║`,
    );
    console.log(
      `║  Catalog: http://localhost:${PORT}/catalog.json        ${" ".repeat(Math.max(0, 12 - String(PORT).length))}║`,
    );
    console.log(
      `║  Health:  http://localhost:${PORT}/health              ${" ".repeat(Math.max(0, 14 - String(PORT).length))}║`,
    );
    console.log("╠══════════════════════════════════════════════════════╣");
    console.log("║  Harness 接入命令：                                     ║");
    console.log(
      `║  dsh market add http://localhost:${PORT}/catalog.json  ${" ".repeat(Math.max(0, 12 - String(PORT).length))}║`,
    );
    console.log("╚══════════════════════════════════════════════════════╝");
    console.log("");

    const total = catalogCache?.metadata?.total || 0;
    if (total > 0) {
      console.log(`  ✅ 已加载 ${total} 项 CCP 能力锚点`);
    }
    if (fetchError) {
      console.log(`  ⚠️  上游连接异常: ${fetchError}`);
    }
    console.log(`  🔄 自动刷新间隔: ${REFRESH_SEC}s`);
    console.log("");
    console.log("  按 Ctrl+C 停止服务");
  });

  // 定时刷新 catalog
  setInterval(() => refreshCatalog(), REFRESH_SEC * 1000);
}

main().catch((e) => {
  console.error("Failed to start:", e.message);
  process.exit(1);
});
