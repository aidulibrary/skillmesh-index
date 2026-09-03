/**
 * 结构化错误码 — CCP 协议 v1.0.0
 * ===============================
 * SkillMesh / 插台 统一 API 错误格式。
 *
 * 错误响应格式（所有错误统一）：
 *   {
 *     "error": {
 *       "code": "CAPABILITY_NOT_FOUND",
 *       "message": "能力锚点不存在",
 *       "message_en": "Capability not found",
 *       "detail": { ... }   // 可选：补充上下文
 *     }
 *   }
 *
 * 使用方式：
 *   import { structuredError } from "./lib/errors.js";
 *   return structuredError("CAPABILITY_NOT_FOUND", { detail: { id: capId } });
 *
 * 版本：v1.0.0
 * 协议：CCP v1.0.0
 */

/** 错误码总表 — 13 种，HTTP 状态码与中英文案冻结 */
export const ERROR_CODES = {
  CAPABILITY_NOT_FOUND: {
    status: 404,
    message: "能力锚点不存在",
    message_en: "Capability not found",
  },
  INVALID_JSON: {
    status: 400,
    message: "JSON 解析失败",
    message_en: "Invalid JSON",
  },
  INVALID_SCHEMA: {
    status: 400,
    message: "Schema 校验失败",
    message_en: "Invalid schema",
  },
  METHOD_NOT_ALLOWED: {
    status: 405,
    message: "方法不允许",
    message_en: "Method not allowed",
  },
  INTERNAL_ERROR: {
    status: 500,
    message: "内部服务器错误",
    message_en: "Internal server error",
  },
  RATE_LIMITED: {
    status: 429,
    message: "请求过于频繁",
    message_en: "Rate limited",
  },
  UNAUTHORIZED: {
    status: 401,
    message: "未授权",
    message_en: "Unauthorized",
  },
  FORBIDDEN: {
    status: 403,
    message: "禁止访问",
    message_en: "Forbidden",
  },
  NODE_NOT_FOUND: {
    status: 404,
    message: "联邦节点不存在",
    message_en: "Federation node not found",
  },
  DUPLICATE_NODE: {
    status: 409,
    message: "节点已存在",
    message_en: "Duplicate federation node",
  },
  EXCHANGE_FAILED: {
    status: 502,
    message: "索引交换失败",
    message_en: "Index exchange failed",
  },
  DB_ERROR: {
    status: 500,
    message: "数据库错误",
    message_en: "Database error",
  },
  VALIDATION_ERROR: {
    status: 400,
    message: "参数校验失败",
    message_en: "Validation error",
  },
};

/** 全部错误码名称列表 */
export const ERROR_LIST = Object.freeze(Object.keys(ERROR_CODES));

/** 按 HTTP 状态码反查默认错误码（仅供旧式调用兜底） */
export const DEFAULT_CODE_BY_STATUS = Object.freeze({
  400: "VALIDATION_ERROR",
  401: "UNAUTHORIZED",
  403: "FORBIDDEN",
  404: "CAPABILITY_NOT_FOUND",
  405: "METHOD_NOT_ALLOWED",
  409: "DUPLICATE_NODE",
  429: "RATE_LIMITED",
  500: "INTERNAL_ERROR",
  502: "EXCHANGE_FAILED",
  503: "DB_ERROR",
});

/**
 * 生成统一错误响应体
 *
 * @param {string} code - 错误码（必须在 ERROR_CODES 中）
 * @param {object} [opts]
 * @param {string} [opts.message] - 覆盖默认中文文案
 * @param {string} [opts.message_en] - 覆盖默认英文文案
 * @param {number} [opts.status] - 覆盖默认 HTTP 状态码
 * @param {*} [opts.detail] - 补充上下文（不向客户端泄露堆栈）
 * @returns {{error: {code:string, message:string, message_en:string, detail?:*}}}
 */
export function errorBody(code, opts = {}) {
  const safeCode = ERROR_CODES[code] ? code : "INTERNAL_ERROR";
  const def = ERROR_CODES[safeCode];
  const error = {
    code: safeCode,
    message: opts.message || def.message,
    message_en: opts.message_en || def.message_en,
  };
  if (opts.detail !== undefined) {
    error.detail = opts.detail;
  }
  return { error };
}

/**
 * 生成统一错误响应（Response）
 *
 * @param {string} code - 错误码
 * @param {object} [opts] - 同 errorBody 的 opts
 * @returns {Response}
 */
export function structuredError(code, opts = {}) {
  const safeCode = ERROR_CODES[code] ? code : "INTERNAL_ERROR";
  const def = ERROR_CODES[safeCode];
  const status = opts.status || def.status;
  const body = errorBody(safeCode, opts);
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-store",
    },
  });
}

export default { ERROR_CODES, ERROR_LIST, DEFAULT_CODE_BY_STATUS, errorBody, structuredError };
