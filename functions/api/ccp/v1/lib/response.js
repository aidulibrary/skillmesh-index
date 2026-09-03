/**
 * HTTP 响应工具
 * =============
 * CCP 协议统一响应格式。
 *
 * 版本：v1.0
 * 协议：CCP v1.0.0
 */

import {
  structuredError,
  ERROR_CODES,
  DEFAULT_CODE_BY_STATUS,
} from "./errors.js";

/**
 * JSON 响应
 *
 * @param {object} data - 响应数据
 * @param {number} status - HTTP 状态码
 * @returns {Response}
 */
export function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=300",
    },
  });
}

/**
 * YAML 响应
 *
 * @param {string} yaml - YAML 内容
 * @param {number} status - HTTP 状态码
 * @returns {Response}
 */
export function yamlResponse(yaml, status = 200) {
  return new Response(yaml, {
    status,
    headers: {
      "Content-Type": "application/x-yaml; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=300",
    },
  });
}

/**
 * 错误响应 — 统一结构化格式
 *
 * @param {string} message - 错误消息（中文可读文案）
 * @param {number} status - HTTP 状态码
 * @param {string} [code] - 结构化错误码；缺省时按 status 反查默认错误码
 * @returns {Response}
 */
export function errorResponse(message, status = 404, code) {
  const finalCode = code || DEFAULT_CODE_BY_STATUS[status] || "INTERNAL_ERROR";
  const def = ERROR_CODES[finalCode];
  return structuredError(finalCode, {
    message: message || def.message,
    status: def.status || status,
  });
}

/**
 * CORS 预检响应
 *
 * @returns {Response}
 */
export function corsResponse() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
    },
  });
}

export default { jsonResponse, yamlResponse, errorResponse, corsResponse };
