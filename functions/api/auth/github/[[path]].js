/**
 * GitHub OAuth 登录
 * =================
 * CCP 协议 v1.0.0 — 贡献者身份锚定。
 *
 * 流程：
 * 1. GET /api/auth/github/login → 重定向到 GitHub OAuth 授权页
 * 2. GET /api/auth/github/callback → GitHub 回调，交换 token，设置 session
 * 3. GET /api/auth/github/user → 获取当前登录用户信息
 * 4. GET /api/auth/github/logout → 清除 session
 *
 * 环境变量：
 * - GITHUB_CLIENT_ID: GitHub OAuth App Client ID
 * - GITHUB_CLIENT_SECRET: GitHub OAuth App Client Secret
 * - SITE_DOMAIN: 站点域名（用于回调 URL）
 *
 * 版本：v1.0.0
 * 协议：CCP v1.0.0
 */

import {
  parseSessionCookie,
  getSessionUser,
  setSessionUser,
  deleteSession,
  generateToken,
  setSessionCookie,
  clearSessionCookie,
} from "../../ccp/v1/lib/session.js";
import { safeErrorResponse } from "../../ccp/v1/lib/error-boundary.js";

const GITHUB_AUTH_URL = "https://github.com/login/oauth/authorize";
const GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token";
const GITHUB_USER_URL = "https://api.github.com/user";

/**
 * 构造 redirect_uri：优先使用请求来源（适配预览部署），
 * 降级到 SITE_DOMAIN 环境变量（生产环境）。
 */
function getRedirectUri(request, env) {
  try {
    const reqUrl = new URL(request.url);
    // 使用请求的 origin，确保预览部署也能正确回调
    return `${reqUrl.origin}/api/auth/github/callback`;
  } catch (_) {
    // 降级：使用配置的域名
    const domain = env.SITE_DOMAIN || "skillmesh.礼字号.中国";
    try {
      const base = new URL(`https://${domain}`).toString().replace(/\/$/, "");
      return `${base}/api/auth/github/callback`;
    } catch (__) {
      return `https://${domain}/api/auth/github/callback`;
    }
  }
}

export async function handleAuthLogin(request, env) {
  const clientId = env.GITHUB_CLIENT_ID;
  if (!clientId) {
    return new Response(
      JSON.stringify({ error: "GitHub OAuth not configured" }),
      { status: 501, headers: { "Content-Type": "application/json" } },
    );
  }

  const redirectUri = getRedirectUri(request, env);
  const state = generateToken();

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: "read:user",
    state,
  });

  // 将 state 写入临时 cookie，回调时校验防 CSRF
  const response = new Response(null, {
    status: 302,
    headers: {
      Location: `${GITHUB_AUTH_URL}?${params}`,
      "Set-Cookie": `ccp_oauth_state=${state}; HttpOnly; Secure; SameSite=Lax; Path=/api/auth/github; Max-Age=600`,
    },
  });
  return response;
}

export async function handleAuthCallback(request, env) {
  try {
    return await handleAuthCallbackInner(request, env);
  } catch (err) {
    return safeErrorResponse(err, "auth/callback");
  }
}

async function handleAuthCallbackInner(request, env) {
  const clientId = env.GITHUB_CLIENT_ID;
  const clientSecret = env.GITHUB_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return new Response(
      JSON.stringify({ error: "GitHub OAuth not configured" }),
      { status: 501, headers: { "Content-Type": "application/json" } },
    );
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (!code) {
    return new Response(
      JSON.stringify({ error: "Missing authorization code" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  // CSRF 校验：对比 cookie 中的 state 与 URL 中的 state
  const cookie = request.headers.get("Cookie") || "";
  const stateMatch = cookie.match(/ccp_oauth_state=([^;]+)/);
  const savedState = stateMatch ? stateMatch[1] : null;
  if (!state || !savedState || state !== savedState) {
    return new Response(JSON.stringify({ error: "Invalid state parameter" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  const tokenResponse = await fetch(GITHUB_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: getRedirectUri(request, env),
    }).toString(),
  });

  const tokenText = await tokenResponse.text();
  let tokenData;
  try {
    tokenData = JSON.parse(tokenText);
  } catch (err) {
    return new Response(
      JSON.stringify({
        error: "token exchange failed",
        httpStatus: tokenResponse.status,
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
  if (tokenData.error) {
    return new Response(
      JSON.stringify({
        error: tokenData.error_description || "Token exchange failed",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const userResponse = await fetch(GITHUB_USER_URL, {
    headers: {
      Authorization: `Bearer ${tokenData.access_token}`,
      Accept: "application/json",
      "User-Agent": "SkillMesh-CCP/1.0",
    },
  });

  const userData = await userResponse.json();
  if (!userData.id) {
    return new Response(
      JSON.stringify({ error: "Failed to fetch user info" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  const sessionToken = generateToken();
  const cookieToken = await setSessionUser(env, sessionToken, {
    github_id: userData.id,
    github_login: userData.login,
    github_name: userData.name || userData.login,
    github_avatar: userData.avatar_url,
  });

  const response = new Response(null, {
    status: 302,
    headers: { Location: new URL(request.url).origin },
  });
  return setSessionCookie(response, cookieToken || sessionToken);
}

export async function handleAuthUser(request, env) {
  try {
    const sessionToken = parseSessionCookie(request);
    if (!sessionToken) {
      return new Response(JSON.stringify({ authenticated: false }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const user = await getSessionUser(env, sessionToken);
    if (!user) {
      return new Response(JSON.stringify({ authenticated: false }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ authenticated: true, user }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return safeErrorResponse(err, "auth/user");
  }
}

export async function handleAuthLogout(request, env) {
  try {
    const sessionToken = parseSessionCookie(request);
    if (sessionToken) {
      await deleteSession(env, sessionToken);
    }

    const response = new Response(null, {
      status: 302,
      headers: { Location: new URL(request.url).origin },
    });
    return clearSessionCookie(response);
  } catch (err) {
    return safeErrorResponse(err, "auth/logout");
  }
}

export async function onRequest(context) {
  try {
    const { request, env } = context;
    const url = new URL(request.url);
    const path = url.pathname;

    if (path.endsWith("/login")) {
      return handleAuthLogin(request, env);
    }
    if (path.endsWith("/callback")) {
      return handleAuthCallback(request, env);
    }
    if (path.endsWith("/user")) {
      return handleAuthUser(request, env);
    }
    if (path.endsWith("/logout")) {
      return handleAuthLogout(request, env);
    }

    return new Response(
      JSON.stringify({
        error: "Not found",
        endpoints: ["/login", "/callback", "/user", "/logout"],
      }),
      { status: 404, headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    return safeErrorResponse(err, "auth/onRequest");
  }
}

export default {
  handleAuthLogin,
  handleAuthCallback,
  handleAuthUser,
  handleAuthLogout,
};
