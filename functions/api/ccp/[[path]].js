/**
 * S13-2: DSH 短 URL 端点（catch-all 路由）
 * =========================================
 * 使用 [[path]] catch-all 匹配 `/api/ccp/{capId}/dsh.yaml`
 * 和 `/api/ccp/{capId}/adapters/dsh`。
 *
 * 路由优先级：Cloudflare Pages 自动将 v1/[[path]].js 视为
 * 更具体的匹配，因此 `/api/ccp/v1/*` 不会被本处理器拦截。
 *
 * 版本：v1.0
 * 协议：CCP v1.0.0
 */

import { findCapStatic } from "./v1/lib/db.js";
import { generateAdapter } from "./v1/handlers/adapters.js";
import { structuredError } from "./v1/lib/errors.js";
import { safeErrorResponse } from "./v1/lib/error-boundary.js";

const ALLOWED_SUFFIXES = [
  "/dsh.yaml",
  "/adapters/dsh",
  "/adapters/mcp",
  "/adapters/langchain",
  "/adapters/crewai",
  "/adapters/dify",
];

const SUFFIX_TO_FRAMEWORK = {
  "/dsh.yaml": "dsh",
  "/adapters/dsh": "dsh",
  "/adapters/mcp": "mcp",
  "/adapters/langchain": "langchain",
  "/adapters/crewai": "crewai",
  "/adapters/dify": "dify",
};

export async function onRequest(context) {
  try {
    const { request, params } = context;

    // catch-all params.path 是数组，如 ["pdf-extract-text-001", "dsh.yaml"]
    const segments = params.path || [];
    if (segments.length === 0) {
      return new Response(JSON.stringify({ error: "Missing path segments" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 仅支持 GET/HEAD
    if (request.method !== "GET" && request.method !== "HEAD") {
      return structuredError("METHOD_NOT_ALLOWED");
    }

    const url = new URL(request.url);
    const path = url.pathname;

    // 验证路径后缀
    const suffix = ALLOWED_SUFFIXES.find((s) => path.endsWith(s));
    if (!suffix) {
      return new Response(
        JSON.stringify({
          error: "Unknown path",
          hint: "Available: /api/ccp/{id}/dsh.yaml or /api/ccp/{id}/adapters/{dsh|mcp|langchain|crewai|dify}",
        }),
        { status: 404, headers: { "Content-Type": "application/json" } },
      );
    }

    // 从路径段提取 capId（去掉后缀部分）
    const suffixSegments = suffix.split("/").filter(Boolean); // ["dsh.yaml"] or ["adapters", "dsh"]
    const capSegments = segments.slice(
      0,
      segments.length - suffixSegments.length,
    );
    const capId = capSegments.join("/") || segments[0];

    if (!capId) {
      return new Response(JSON.stringify({ error: "Missing capability ID" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 查找能力锚点
    const cap = findCapStatic(capId);
    if (!cap) {
      return structuredError("CAPABILITY_NOT_FOUND", {
        detail: {
          id: capId,
          message: `Capability anchor not found: ${capId}`,
          hint: "Browse https://skillmesh.礼字号.中国 to discover available capabilities",
        },
      });
    }

    const framework = SUFFIX_TO_FRAMEWORK[suffix] || "dsh";
    const adapter = generateAdapter(cap, framework);
    if (!adapter) {
      return structuredError("CAPABILITY_NOT_FOUND", {
        detail: {
          id: capId,
          message: `Unable to generate ${framework} adapter for: ${capId}`,
        },
      });
    }

    const contentType =
      adapter.type === "json"
        ? "application/json; charset=utf-8"
        : "application/x-yaml; charset=utf-8";
    const fileExt = adapter.type === "json" ? "json" : "yaml";

    return new Response(adapter.content, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${capId}.${fileExt}"`,
        "Cache-Control": "public, max-age=3600",
        "Access-Control-Allow-Origin": "*",
        "X-CCP-Version": "v1.0.0",
        "X-CCP-Capability-Id": capId,
        "X-CCP-Adapter-Framework": framework,
      },
    });
  } catch (err) {
    return safeErrorResponse(
      err,
      `ccp-dsh-yaml:${params?.path?.join("/") || "unknown"}`,
    );
  }
}
