// Cloudflare Pages Functions 中间件
// 补充 _headers 无法覆盖的场景，统一缓存与安全策略
// 包含：全局 API 限流 + 请求追踪 ID

const SECURITY_HEADERS = {
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
};

// ========== 全局 API 限流 ==========
// 每 IP 每分钟最多 60 次 API 请求
const RATE_LIMIT_WINDOW_MS = 60000;
const RATE_LIMIT_MAX = 60;
const rateLimitStore = new Map();

function isRateLimited(ip) {
  const now = Date.now();
  const entry = rateLimitStore.get(ip);

  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitStore.set(ip, { windowStart: now, count: 1 });
    return false;
  }

  entry.count++;
  if (entry.count > RATE_LIMIT_MAX) {
    return true;
  }
  return false;
}

function getClientIP(request) {
  return (
    request.headers.get("CF-Connecting-IP") ||
    request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() ||
    "127.0.0.1"
  );
}

// ========== 请求追踪 ID ==========
function generateTraceId() {
  const ts = Date.now().toString(36);
  const rand = crypto.randomUUID
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 10);
  return `ccp-${ts}-${rand}`;
}

/**
 * 判断是否为静态资源（长期缓存）
 */
function isStaticAsset(pathname) {
  return (
    pathname.startsWith("/css/") ||
    pathname.startsWith("/js/") ||
    pathname.startsWith("/assets/")
  );
}

/**
 * 判断是否为文档资源
 */
function isDocument(pathname) {
  return pathname.startsWith("/docs/");
}

/**
 * 判断是否为 API 请求
 */
function isApi(pathname) {
  return pathname.startsWith("/api/");
}

/**
 * 判断是否为 HTML 入口
 * 覆盖：根路径、*.html、目录路径（以 / 结尾）、以及无扩展名的页面路由
 *（如 /health、/api-docs），排除 /api/ 与 /docs/ 前缀。
 */
function isHtmlEntry(pathname) {
  if (pathname === "/") return true;
  if (pathname.startsWith("/api/")) return false;
  if (pathname.startsWith("/docs/")) return false;
  if (pathname.endsWith(".html")) return true;
  if (pathname.endsWith("/")) return true;
  const lastSegment = pathname.split("/").pop() || "";
  return !lastSegment.includes(".");
}

export async function onRequest(context) {
  try {
    const url = new URL(context.request.url);
    const { pathname } = url;
    const traceId = generateTraceId();

    // API 限流检查
    if (isApi(pathname)) {
      const ip = getClientIP(context.request);
      if (isRateLimited(ip)) {
        return new Response(
          JSON.stringify({
            error: {
              code: "RATE_LIMITED",
              message: "请求过于频繁，请稍后重试",
              message_en: "Too many requests, please try again later",
              trace_id: traceId,
            },
          }),
          {
            status: 429,
            headers: {
              "Content-Type": "application/json",
              "Retry-After": "60",
              "X-Trace-Id": traceId,
            },
          },
        );
      }
    }

    const response = await context.next();

    // 克隆响应以便修改头
    const newResponse = new Response(response.body, response);

    // 统一附加安全头（如果上游未设置）
    for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
      if (!newResponse.headers.has(key)) {
        newResponse.headers.set(key, value);
      }
    }

    // 统一附加追踪 ID
    newResponse.headers.set("X-Trace-Id", traceId);

    if (isHtmlEntry(pathname)) {
      // D6：HTML 入口必须与 _headers 保持一致（max-age=0, must-revalidate）。
      // 此前此处无条件覆盖为 1 小时公开缓存，会盖掉 _headers 的规则，
      // 导致用户长时间看到旧版首页（多语言/样式失效的假故障即由此放大）。
      newResponse.headers.set(
        "Cache-Control",
        "public, max-age=0, must-revalidate",
      );
      return newResponse;
    }

    if (isStaticAsset(pathname)) {
      // 静态资源：长期缓存（由 _headers 主控，此处兜底）
      if (!newResponse.headers.has("Cache-Control")) {
        newResponse.headers.set(
          "Cache-Control",
          "public, max-age=31536000, immutable",
        );
      }
      return newResponse;
    }

    if (isDocument(pathname)) {
      // 文档：一周新鲜度
      if (!newResponse.headers.has("Cache-Control")) {
        newResponse.headers.set(
          "Cache-Control",
          "public, max-age=604800, stale-while-revalidate=86400",
        );
      }
      return newResponse;
    }

    if (isApi(pathname)) {
      // API：禁止缓存
      newResponse.headers.set("Cache-Control", "no-store");
      return newResponse;
    }

    return newResponse;
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "middleware error", detail: err.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}
