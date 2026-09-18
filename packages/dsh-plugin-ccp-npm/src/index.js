/**
 * DSH Plugin CCP — Cordis 插件入口
 * ==================================
 *
 * 以 Cordis plugin 模式注册 3 个服务：
 *   ctx.provide("ccp_search",    ...)
 *   ctx.provide("ccp_detail",    ...)
 *   ctx.provide("ccp_telemetry", ...)
 *
 * 同时导出独立工具函数，支持非 Cordis 环境直接调用。
 *
 * 版本：v2.0.0
 */

import { createTools, telemetryWrapper } from "./tools.js";

let toolsInstance = null;

function getTools(config) {
  if (!toolsInstance) toolsInstance = createTools(config);
  return toolsInstance;
}

export function apply(ctx, config = {}) {
  const tools = getTools(config);

  ctx.provide("ccp_search", tools.ccp_search);
  ctx.provide("ccp_detail", tools.ccp_detail);
  ctx.provide("ccp_telemetry", tools.ccp_telemetry);

  ctx.on("dispose", () => {
    toolsInstance = null;
  });
}

export { createTools, telemetryWrapper };
export const ccp_search = (q, category) => getTools().ccp_search(q, category);
export const ccp_detail = (id, framework) => getTools().ccp_detail(id, framework);
export const ccp_telemetry = (id, success, latency) => getTools().ccp_telemetry(id, success, latency);
