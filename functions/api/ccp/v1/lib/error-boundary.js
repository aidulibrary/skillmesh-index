/**
 * Error Boundary — 全局异常兜底
 * ==============================
 * CCP 协议 v1.0.0 — 确保任何未捕获异常都转为可读 JSON 响应，
 * 而非 Cloudflare Workers 原生 1101 错误。
 *
 * 使用方式：
 *   import { withErrorBoundary } from "./lib/error-boundary.js";
 *   export const onRequest = withErrorBoundary(async (context) => { ... });
 *
 * 版本：v1.0.0
 * 协议：CCP v1.0.0
 */

import { structuredError } from "./errors.js";

/**
 * 安全错误响应 — 不泄露内部堆栈
 *
 * 输出统一结构化错误码 INTERNAL_ERROR：
 *   { error: { code, message, message_en, detail } }
 *
 * @param {Error} err - 原始异常
 * @param {string} context - 错误发生的上下文（端点/操作名）
 * @returns {Response}
 */
export function safeErrorResponse(err, context = "unknown") {
  const message = err && err.message ? err.message : "Internal server error";
  const name = err && err.name ? err.name : "Error";

  return structuredError("INTERNAL_ERROR", {
    detail: {
      context,
      name,
      message,
    },
  });
}

/**
 * 高阶函数 — 包装 onRequest handler，自动捕获异常
 *
 * @param {Function} handler - 原始 onRequest 函数 (context) => Response
 * @param {string} label - 端点标签（用于错误日志）
 * @returns {Function} 包装后的 onRequest 函数
 */
export function withErrorBoundary(handler, label = "request") {
  return async function (context) {
    try {
      return await handler(context);
    } catch (err) {
      console.error(
        `[${label}] uncaught:`,
        err && err.message,
        err && err.stack,
      );
      return safeErrorResponse(err, label);
    }
  };
}

export default { safeErrorResponse, withErrorBoundary };
