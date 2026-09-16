/**
 * S13-2: DSH 短 URL 端点
 * ======================
 * 协议定义 `/api/ccp/{id}/dsh.yaml` 端点，使 DSH CLI 可通过
 * `dsh plugin add https://skillmesh.礼字号.中国/api/ccp/{id}/dsh.yaml`
 * 直接安装能力插台提供的插件。
 *
 * 实现策略：
 * - 路径 `/api/ccp/{capId}/dsh.yaml` → YAML 响应
 * - 路径 `/api/ccp/{capId}/adapters/dsh` → 同义兼容路由
 * - 仅 GET，返回 Content-Type: application/x-yaml
 * - 能力不存在 → 404
 * - 其他路径 → 404
 *
 * 版本：v1.0
 * 协议：CCP v1.0.0
 */

import { findCapStatic } from "./v1/lib/db.js";
import { generateAdapter } from "./v1/handlers/adapters.js";
import { structuredError } from "./v1/lib/errors.js";
import { safeErrorResponse } from "./v1/lib/error-boundary.js";

const ALLOWED_SUFFIXES = ["/dsh.yaml", "/adapters/dsh"];

export async function onRequest(context) {
  try {
    const { request, params } = context;
    const capId = params.capId;

    if (!capId) {
      return new Response(JSON.stringify({ error: "Missing capability ID" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 仅支持 GET
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json" },
      });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    // 验证路径后缀为 /dsh.yaml 或 /adapters/dsh
    const suffix = ALLOWED_SUFFIXES.find((s) => path.endsWith(s));
    if (!suffix) {
      return new Response(
        JSON.stringify({
          error: "Unknown path",
          hint: `Available: /api/ccp/{id}/dsh.yaml or /api/ccp/{id}/adapters/dsh`,
        }),
        { status: 404, headers: { "Content-Type": "application/json" } },
      );
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

    const adapter = generateAdapter(cap, "dsh");
    if (!adapter) {
      return structuredError("CAPABILITY_NOT_FOUND", {
        detail: {
          id: capId,
          message: `Unable to generate DSH adapter for: ${capId}`,
        },
      });
    }

    return new Response(adapter.content, {
      status: 200,
      headers: {
        "Content-Type": "application/x-yaml; charset=utf-8",
        "Content-Disposition": `inline; filename="${capId}.yaml"`,
        "Cache-Control": "public, max-age=3600",
        "Access-Control-Allow-Origin": "*",
        "X-CCP-Version": "v1.0.0",
        "X-CCP-Capability-Id": capId,
      },
    });
  } catch (err) {
    return safeErrorResponse(err, `ccp-dsh-yaml:${params?.capId || "unknown"}`);
  }
}
