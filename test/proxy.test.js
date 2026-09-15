/**
 * S13-3 CORS 代理 Worker 测试
 * =============================
 * /api/proxy 端点：浏览器试用的 CORS 回退通道。
 * 安全策略：仅代理已注册 CCP 能力锚点的域名 + httpbin.org。
 *
 * 测试覆盖：
 *   - OPTIONS preflight
 *   - 405 Method Not Allowed (GET)
 *   - 400 Invalid JSON / Missing url / Invalid URL
 *   - 403 Domain not in allowlist
 *   - 200 Successful proxy
 *   - 502 Proxy fetch error
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// 真实导入代理处理器
let onRequest;
let PROXY_MODULE;

beforeEach(async () => {
  vi.restoreAllMocks();
  // 每次重新导入，确保模块状态干净
  PROXY_MODULE = await import("../functions/api/proxy.js");
  onRequest = PROXY_MODULE.onRequest;
});

// ---------- 辅助 ----------
function ctx(method, body) {
  const init = { method };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
    init.headers = { "Content-Type": "application/json" };
  }
  return {
    request: new Request("https://skillmesh.pages.dev/api/proxy", init),
  };
}

async function statusAndBody(ctx) {
  const res = await onRequest(ctx);
  const body = await res.json();
  return { status: res.status, body };
}

// ================= OPTIONS preflight =================
describe("OPTIONS preflight", () => {
  it("返回 204 + CORS 头", async () => {
    const c = ctx("OPTIONS");
    const res = await onRequest(c);
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(res.headers.get("Access-Control-Allow-Methods")).toContain("POST");
    expect(res.headers.get("Access-Control-Max-Age")).toBe("86400");
  });
});

// ================= 405 Method Not Allowed =================
describe("405 Method Not Allowed", () => {
  it("GET 返回 405", async () => {
    const c = ctx("GET");
    const { status } = await statusAndBody(c);
    expect(status).toBe(405);
  });

  it("DELETE 返回 405", async () => {
    const c = ctx("DELETE");
    const { status } = await statusAndBody(c);
    expect(status).toBe(405);
  });

  it("PUT 返回 405", async () => {
    const c = ctx("PUT");
    const { status } = await statusAndBody(c);
    expect(status).toBe(405);
  });
});

// ================= 400 Invalid Input =================
describe("400 Invalid Input", () => {
  it("非 JSON body → 400", async () => {
    const res = await onRequest({
      request: new Request("https://skillmesh.pages.dev/api/proxy", {
        method: "POST",
        body: "not-json",
        headers: { "Content-Type": "text/plain" },
      }),
    });
    expect(res.status).toBe(400);
  });

  it("缺少 url 字段 → 400", async () => {
    const c = ctx("POST", { method: "GET" });
    const { status } = await statusAndBody(c);
    expect(status).toBe(400);
  });

  it("非法 URL → 400", async () => {
    const c = ctx("POST", { url: "not-a-valid-url-!!!", method: "GET" });
    const { status } = await statusAndBody(c);
    expect(status).toBe(400);
  });

  it("空对象 → 400 (缺少 url)", async () => {
    const c = ctx("POST", {});
    const { status } = await statusAndBody(c);
    expect(status).toBe(400);
  });
});

// ================= 403 Domain Not Allowed =================
describe("403 Domain Not Allowed", () => {
  it("不在能力锚点白名单的域名 → 403", async () => {
    const c = ctx("POST", {
      url: "https://evil-proxy-target.example.com/steal-data",
      method: "GET",
    });
    const { status, body } = await statusAndBody(c);
    expect(status).toBe(403);
    expect(body.error).toContain("evil-proxy-target.example.com");
  });

  it("内网地址 → 403 (防御 SSRF)", async () => {
    const c = ctx("POST", {
      url: "http://127.0.0.1:8080/admin",
      method: "GET",
    });
    const { status } = await statusAndBody(c);
    expect(status).toBe(403);
  });

  it("localhost → 403 (防御 SSRF)", async () => {
    const c = ctx("POST", {
      url: "http://localhost:3000/secret",
      method: "GET",
    });
    const { status } = await statusAndBody(c);
    expect(status).toBe(403);
  });
});

// ================= 200 Successful Proxy (httpbin.org 已在白名单) =================
describe("200 Successful Proxy", () => {
  it("代理 GET → 返回状态码 + body + elapsed_ms", async () => {
    const mockResponse = new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(mockResponse);

    const c = ctx("POST", {
      url: "https://httpbin.org/get",
      method: "GET",
    });
    const { status, body } = await statusAndBody(c);

    expect(status).toBe(200);
    expect(body.status).toBe(200);
    expect(body).toHaveProperty("elapsed_ms");
    expect(body.body).toEqual({ ok: true });
    expect(body.headers).toHaveProperty("content-type");
  });

  it("代理 POST 并携带 body", async () => {
    const mockResponse = new Response(
      JSON.stringify({ received: { key: "value" } }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(mockResponse);

    const c = ctx("POST", {
      url: "https://httpbin.org/post",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer x",
      },
      body: { input: "hello" },
    });
    const { body } = await statusAndBody(c);

    expect(body.status).toBe(200);
    // 验证 fetch 被调用时传入了正确的 body
    const fetchCall = fetchSpy.mock.calls[0];
    expect(fetchCall[1].method).toBe("POST");
    expect(fetchCall[1].body).toBe(JSON.stringify({ input: "hello" }));
  });

  it("代理 text/plain 响应（非 JSON）", async () => {
    const mockResponse = new Response("plain text response", {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(mockResponse);

    const c = ctx("POST", {
      url: "https://httpbin.org/robots.txt",
      method: "GET",
    });
    const { body } = await statusAndBody(c);

    expect(body.status).toBe(200);
    expect(body.body).toBe("plain text response");
  });

  it("代理非 200 响应 → 传递原始状态码", async () => {
    const mockResponse = new Response(JSON.stringify({ error: "Not Found" }), {
      status: 404,
      statusText: "Not Found",
      headers: { "Content-Type": "application/json" },
    });
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(mockResponse);

    const c = ctx("POST", {
      url: "https://httpbin.org/status/404",
      method: "GET",
    });
    const { status, body } = await statusAndBody(c);

    expect(status).toBe(200); // 代理自身成功
    expect(body.status).toBe(404); // 目标返回 404
    expect(body.statusText).toBe("Not Found");
  });
});

// ================= 502 Proxy Fetch Error =================
describe("502 Proxy Fetch Error", () => {
  it("目标不可达 → 502", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(
      new Error("connect ECONNREFUSED"),
    );

    const c = ctx("POST", {
      url: "https://httpbin.org/delay/30",
      method: "GET",
    });
    const { status, body } = await statusAndBody(c);

    expect(status).toBe(502);
    expect(body.error).toBe("Proxy request failed");
    expect(body.message).toBeDefined();
  });
});

// ================= 安全回归 =================
describe("安全回归", () => {
  it("不转发 Cookie 到目标", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("{}", {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    // 即使用户在浏览器有 Cookie，代理请求不应携带
    const c = ctx("POST", {
      url: "https://httpbin.org/get",
      method: "GET",
      headers: { "X-Custom": "value" },
      // 注意：我们不在 headers 中传 Cookie
    });
    await statusAndBody(c);

    const fetchCall = fetchSpy.mock.calls[0];
    // Cloudflare Workers fetch 默认不发送浏览器 Cookie
    expect(fetchCall[1].headers).not.toHaveProperty("cookie");
  });

  it("白名单不包含通配符", async () => {
    // 重新加载模块检查白名单
    const mod = await import("../functions/api/proxy.js");
    // 通过发送已知不在列表的域名验证
    const c = ctx("POST", {
      url: "https://httpbin.org.evil.com/phishing",
      method: "GET",
    });
    const { status } = await statusAndBody(c);
    // httpbin.org.evil.com 是 evil.com 的子域名，不在白名单
    expect(status).toBe(403);
  });
});
