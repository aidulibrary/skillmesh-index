/**
 * OAuth Session 共享库
 * =====================
 * CCP 协议 v1.0.0 — GitHub OAuth session 解析。
 *
 * 双模式策略：
 * - 优先：KV 存储（需绑定 KV_SESSIONS）
 * - 降级：JWT 自签名 cookie（无需外部存储，生产就绪）
 *
 * 降级模式使用 HMAC-SHA256 签名，密钥来自 GITHUB_CLIENT_SECRET 或 SESSION_SECRET。
 * 不依赖任何外部服务，零配置即可运行。
 *
 * 版本：v1.0.0
 * 协议：CCP v1.0.0
 */

const COOKIE_NAME = "ccp_session";
const SESSION_TTL = 86400; // 24 小时

// ---- JWT（自签名 cookie）--------------------------

function base64UrlEncode(str) {
  // 先转 UTF-8 字节，避免 btoa 对中文等非 Latin1 字符抛 InvalidCharacterError
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64UrlDecode(str) {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) str += "=";
  const binary = atob(str);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

async function signPayload(env, payload) {
  const secret =
    env.SESSION_SECRET || env.GITHUB_CLIENT_SECRET || "skillmesh-ccp";
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return base64UrlEncode(String.fromCharCode(...new Uint8Array(sig)));
}

async function verifySignature(env, payload, signature) {
  const expected = await signPayload(env, payload);
  return expected === signature;
}

function encodeJwt(user) {
  const header = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = base64UrlEncode(
    JSON.stringify({
      ...user,
      exp: Math.floor(Date.now() / 1000) + SESSION_TTL,
      iat: Math.floor(Date.now() / 1000),
    }),
  );
  return `${header}.${body}`;
}

function decodeJwtPayload(token) {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    return JSON.parse(base64UrlDecode(parts[1]));
  } catch (_) {
    return null;
  }
}

// ---- 公开 API -------------------------------------

export function parseSessionCookie(request) {
  const cookie = request.headers.get("Cookie") || "";
  const match = cookie.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  return match ? match[1] : null;
}

export async function getSessionUser(env, sessionToken) {
  if (!env) return null;

  // 模式 1：KV 存储
  if (env.KV_SESSIONS) {
    try {
      const data = await env.KV_SESSIONS.get(`session:${sessionToken}`, "json");
      if (data) return data;
    } catch (_) {}
  }

  // 模式 2：JWT 自签名 cookie
  try {
    const payload = decodeJwtPayload(sessionToken);
    if (!payload || !payload.exp) return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;

    const parts = sessionToken.split(".");
    const signedPayload = `${parts[0]}.${parts[1]}`;
    const valid = await verifySignature(env, signedPayload, parts[2]);
    if (!valid) return null;

    const { exp, iat, ...user } = payload;
    return user;
  } catch (_) {
    return null;
  }
}

export async function setSessionUser(env, sessionToken, user) {
  if (!env) return null;

  // 模式 1：KV 存储
  if (env.KV_SESSIONS) {
    try {
      await env.KV_SESSIONS.put(
        `session:${sessionToken}`,
        JSON.stringify(user),
        { expirationTtl: SESSION_TTL },
      );
      return sessionToken;
    } catch (_) {}
  }

  // 模式 2：JWT 自签名 cookie
  const payload = encodeJwt(user);
  const signature = await signPayload(env, payload);
  return `${payload}.${signature}`;
}

export async function deleteSession(env, sessionToken) {
  if (!env) return;

  // 模式 1：KV 存储
  if (env.KV_SESSIONS) {
    try {
      await env.KV_SESSIONS.delete(`session:${sessionToken}`);
    } catch (_) {}
  }
  // 模式 2：JWT 自签名 — 客户端清除 cookie 即可，无需服务端操作
}

export function generateToken() {
  return crypto.randomUUID();
}

export function setSessionCookie(response, token) {
  response.headers.set(
    "Set-Cookie",
    `${COOKIE_NAME}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${SESSION_TTL}`,
  );
  return response;
}

export function clearSessionCookie(response) {
  response.headers.set(
    "Set-Cookie",
    `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`,
  );
  return response;
}

export default {
  parseSessionCookie,
  getSessionUser,
  setSessionUser,
  deleteSession,
  generateToken,
  setSessionCookie,
  clearSessionCookie,
};
