/**
 * S13-2: DSH 短 URL 端点测试（catch-all 路由）
 * =============================================
 * `/api/ccp/{id}/dsh.yaml` — DSH CLI 可直接安装的能力插台插件端点
 *
 * 路由使用 [[path]] catch-all 解析路径段数组，
 * 避免与 v1/[[path]].js 的路由歧义。
 *
 * 测试覆盖：
 *   - 200 现有能力 → 返回 YAML
 *   - 200 /adapters/dsh 兼容路由
 *   - 404 不存在的 ID
 *   - 404 未知路径后缀
 *   - 405 非 GET 方法
 *   - 200 HEAD 请求（轻量检查）
 *   - YAML 结构完整性
 *   - CORS / 缓存 / 协议头
 */

import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";

const BASE = "https://skillmesh.pages.dev";
let onRequest;

beforeEach(async () => {
  vi.restoreAllMocks();
  const mod = await import("../functions/api/ccp/[[path]].js");
  onRequest = mod.onRequest;
});

function pathSegments(urlPath) {
  const p = new URL(BASE + urlPath).pathname;
  const parts = p.split("/").filter(Boolean);
  return parts.slice(2);
}

function ctx(urlPath, method = "GET") {
  const segs = pathSegments(urlPath);
  return {
    request: new Request(`${BASE}${urlPath}`, { method }),
    params: { path: segs },
  };
}

function dshCtx(capId) {
  return ctx(`/api/ccp/${capId}/dsh.yaml`);
}

function adapterCtx(capId) {
  return ctx(`/api/ccp/${capId}/adapters/dsh`);
}

// ================= 200 成功 =================
describe("200 成功返回 DSH YAML", () => {
  it("已知能力 pdf-extract-text-001 → 返回 YAML", async () => {
    const res = await onRequest(dshCtx("pdf-extract-text-001"));

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("application/x-yaml");
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(res.headers.get("Cache-Control")).toContain("max-age=3600");
    expect(res.headers.get("X-CCP-Capability-Id")).toBe("pdf-extract-text-001");

    const text = await res.text();
    expect(text).toContain("apiVersion: deepseek.io/plugin/v1");
    expect(text).toContain("kind: Plugin");
    expect(text).toContain("pdf-extract-text-001");
  });

  it("兼容路由 /adapters/dsh → 同样返回 YAML", async () => {
    const res = await onRequest(adapterCtx("pdf-extract-text-001"));

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("application/x-yaml");
    const text = await res.text();
    expect(text).toContain("apiVersion: deepseek.io/plugin/v1");
  });

  it("HEAD 请求 → 200（无 body 但有头）", async () => {
    const res = await onRequest({
      request: new Request(`${BASE}/api/ccp/pdf-extract-text-001/dsh.yaml`, {
        method: "HEAD",
      }),
      params: { path: ["pdf-extract-text-001", "dsh.yaml"] },
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("application/x-yaml");
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("另一个能力 web-scrape-003 → 返回 YAML", async () => {
    const res = await onRequest(dshCtx("web-scrape-003"));

    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("web-scrape-003");
    expect(text).toContain("kind: Plugin");
  });
});

// ================= 404 不存在 =================
describe("404 不存在的能力", () => {
  it("不存在的 ID → 404", async () => {
    const res = await onRequest(dshCtx("nonexistent-cap-999"));
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error.code).toBe("CAPABILITY_NOT_FOUND");
    expect(body.error.detail.id).toBe("nonexistent-cap-999");
  });

  it("空路径段 → 400", async () => {
    const res = await onRequest({
      request: new Request(`${BASE}/api/ccp?`, { method: "GET" }),
      params: { path: [] },
    });
    expect(res.status).toBe(400);
  });
});

// ================= 404 路径 =================
describe("404 未知路径", () => {
  it("/api/ccp/{id}/unknown → 404", async () => {
    const res = await onRequest(ctx("/api/ccp/pdf-extract-text-001/unknown"));
    expect(res.status).toBe(404);
  });

  it("/api/ccp/{id} → 404（仅 /dsh.yaml 和 /adapters/dsh 有效）", async () => {
    const res = await onRequest({
      request: new Request(`${BASE}/api/ccp/pdf-extract-text-001`, {
        method: "GET",
      }),
      params: { path: ["pdf-extract-text-001"] },
    });
    expect(res.status).toBe(404);
  });
});

// ================= 405 方法 =================
describe("405 方法不允许", () => {
  it("POST → 405", async () => {
    const res = await onRequest(
      ctx("/api/ccp/pdf-extract-text-001/dsh.yaml", "POST"),
    );
    expect(res.status).toBe(405);
  });

  it("PUT → 405", async () => {
    const res = await onRequest(
      ctx("/api/ccp/pdf-extract-text-001/dsh.yaml", "PUT"),
    );
    expect(res.status).toBe(405);
  });

  it("DELETE → 405", async () => {
    const res = await onRequest(
      ctx("/api/ccp/pdf-extract-text-001/dsh.yaml", "DELETE"),
    );
    expect(res.status).toBe(405);
  });
});

// ================= YAML 结构完整性 =================
describe("YAML 结构完整性", () => {
  let yaml;

  beforeAll(async () => {
    const res = await onRequest(dshCtx("pdf-extract-text-001"));
    yaml = await res.text();
  });

  it("含完整 metadata 块", () => {
    expect(yaml).toContain("apiVersion:");
    expect(yaml).toContain("kind: Plugin");
    expect(yaml).toContain("metadata:");
    expect(yaml).toContain("description:");
    expect(yaml).toContain("license:");
    expect(yaml).toContain("homepage:");
  });

  it("含 runtime 块", () => {
    expect(yaml).toContain("runtime:");
    expect(yaml).toContain("entrypoint:");
  });

  it("含 permissions 块（含 riskScore）", () => {
    expect(yaml).toContain("permissions:");
    expect(yaml).toContain("riskScore:");
  });

  it("含 capabilities 声明", () => {
    expect(yaml).toContain("capabilities:");
  });

  it("含 CCP 信任向量注释", () => {
    expect(yaml).toContain("trustSource:");
    expect(yaml).toContain("trustUsage:");
    expect(yaml).toContain("trustRisk:");
    expect(yaml).toContain("evidence:");
  });

  it("Content-Disposition 含正确文件名", async () => {
    const res = await onRequest(dshCtx("pdf-extract-text-001"));
    expect(res.headers.get("Content-Disposition")).toContain(
      "pdf-extract-text-001.yaml",
    );
  });
});
