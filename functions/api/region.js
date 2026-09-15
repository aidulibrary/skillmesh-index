/**
 * S12-B：地域检测端点
 * ==============================
 * 返回 IP 归属地国家代码，供客户端语言自动适配使用。
 * Cloudflare Pages 环境提供 request.cf.country。
 *
 * GET /api/region
 *
 * 响应：{ "country": "JP" | "US" | "CN" | ... | "" }
 * 降级：若不在 CF 环境中，返回空 country
 */

export async function onRequest(context) {
  const { request } = context;

  try {
    const cf = request.cf || {};
    const country = cf.country || "";

    return new Response(JSON.stringify({ country }), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "private, max-age=86400",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch {
    return new Response(JSON.stringify({ country: "" }), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "private, max-age=86400",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }
}
