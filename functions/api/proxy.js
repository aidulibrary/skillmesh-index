import { CAPABILITIES } from "../_data/capabilities";
import { safeErrorResponse } from "./ccp/v1/lib/error-boundary.js";

const ALLOWED_DOMAINS = new Set(
  CAPABILITIES.filter((c) => c.endpointType === "http")
    .map((c) => {
      try {
        return new URL(c.endpoint).hostname;
      } catch (_) {
        return null;
      }
    })
    .filter(Boolean),
);

// 测试与调试域名白名单
ALLOWED_DOMAINS.add("httpbin.org");

export async function onRequest(context) {
  try {
    if (context.request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    if (context.request.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    let payload;
    try {
      payload = await context.request.json();
    } catch (_) {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    const {
      url: targetUrl,
      method = "GET",
      headers: reqHeaders = {},
      body,
    } = payload;

    if (!targetUrl) {
      return new Response(JSON.stringify({ error: "Missing url field" }), {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    let targetHostname;
    try {
      targetHostname = new URL(targetUrl).hostname;
    } catch (_) {
      return new Response(JSON.stringify({ error: "Invalid target URL" }), {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    if (!ALLOWED_DOMAINS.has(targetHostname)) {
      return new Response(
        JSON.stringify({
          error: `Domain not in capability allowlist: ${targetHostname}`,
          hint: "仅支持已注册为 CCP 能力锚点的 HTTP 端点",
        }),
        {
          status: 403,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        },
      );
    }

    try {
      const fetchOptions = {
        method: method.toUpperCase(),
        headers: reqHeaders,
      };

      if (body && method.toUpperCase() !== "GET") {
        fetchOptions.body =
          typeof body === "string" ? body : JSON.stringify(body);
      }

      const startTime = Date.now();
      const response = await fetch(targetUrl, fetchOptions);
      const elapsed = Date.now() - startTime;

      let responseBody;
      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        responseBody = await response.json();
      } else {
        responseBody = await response.text();
      }

      return new Response(
        JSON.stringify({
          status: response.status,
          statusText: response.statusText,
          elapsed_ms: elapsed,
          headers: Object.fromEntries(response.headers.entries()),
          body: responseBody,
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Access-Control-Allow-Origin": "*",
          },
        },
      );
    } catch (err) {
      return new Response(
        JSON.stringify({
          error: "Proxy request failed",
          message: err.message,
          hint: "目标 API 可能不可达或拒绝了请求",
        }),
        {
          status: 502,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        },
      );
    }
  } catch (err) {
    return safeErrorResponse(err, "proxy");
  }
}
