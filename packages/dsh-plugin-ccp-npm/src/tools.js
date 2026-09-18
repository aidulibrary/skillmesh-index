/**
 * DSH Plugin CCP — CCP 协议能力发现层
 * =====================================
 *
 * 提供三个 DSH 工具：
 * - ccp_search:    搜索能力锚点
 * - ccp_detail:    获取能力详情 + 生成适配器
 * - ccp_telemetry: 回传调用结果（信任向量闭环）
 *
 * 版本：v2.0.0（Cordis/npm 重写）
 * 协议：CCP v1.0.0
 */

import { CCPClient } from "@skillmesh-ccp/ccp-client";

const DEFAULT_ENDPOINT = "https://skillmesh.礼字号.中国/api/ccp/v1";

export function createTools(config = {}) {
  const {
    endpoint = process.env.CCP_ENDPOINT || DEFAULT_ENDPOINT,
    federated = process.env.CCP_FEDERATED === "true",
    agentId = "dsh-plugin-ccp",
  } = config;

  const client = new CCPClient({ baseUrl: endpoint, agentId });

  return {
    ccp_search,
    ccp_detail,
    ccp_telemetry,
    client,
  };

  async function ccp_search(q, category) {
    const result = await client.search(q, { category, federated: federated ? "true" : undefined });
    if (result.error) return { error: result.error, results: [], count: 0 };

    const summary = (result.results || []).map((cap) => ({
      id: cap.id,
      name: cap.name,
      name_en: cap.name_en,
      desc: cap.desc,
      category: cap.category,
      endpoint_type: cap.endpointType || cap.endpoint_type,
      trust: {
        source: cap.trustSource ?? cap.trust_source,
        usage_rate: cap.trustUsageRate ?? cap.trust_usage_rate,
        success: cap.trustSuccess ?? cap.trust_success,
        risk: cap.trustRisk ?? cap.trust_risk,
        time: cap.trustTime ?? cap.trust_time,
      },
    }));

    return { query: result.query || q, count: summary.length, federated: result.federated || false, results: summary };
  }

  async function ccp_detail(capabilityId, framework = "dsh") {
    const [detail, adapter] = await Promise.all([
      client.detail(capabilityId).catch(() => null),
      client.adapter(capabilityId, framework).catch(() => null),
    ]);

    if (!detail && !adapter) {
      return { error: { code: "NOT_FOUND", detail: `Capability ${capabilityId} not found` } };
    }
    if (detail?.error) return { error: detail.error };

    return { ...detail, adapter: adapter?.adapter || null, framework };
  }

  async function ccp_telemetry(capabilityId, success, latencyMs = 0) {
    const result = await client.telemetry(capabilityId, success, latencyMs, "dsh", "dsh-plugin-ccp");
    if (result?.error) return { error: result.error, acknowledged: false };
    return { acknowledged: true, capability_id: capabilityId, source: "dsh" };
  }
}

export function telemetryWrapper(fn, capabilityId) {
  const start = Date.now();
  try {
    const result = fn();
    const latency = Date.now() - start;
    if (result instanceof Promise) {
      return result.then((r) => {
        telemetryFireAndForget(capabilityId, true, latency);
        return r;
      }).catch((e) => {
        telemetryFireAndForget(capabilityId, false, Date.now() - start);
        throw e;
      });
    }
    telemetryFireAndForget(capabilityId, true, latency);
    return result;
  } catch (e) {
    telemetryFireAndForget(capabilityId, false, Date.now() - start);
    throw e;
  }
}

function telemetryFireAndForget(capabilityId, success, latencyMs) {
  const endpoint = process.env.CCP_ENDPOINT || DEFAULT_ENDPOINT;
  fetch(`${endpoint}/telemetry`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      capability_id: capabilityId,
      success,
      latency_ms: latencyMs,
      agent_id: "dsh-plugin-ccp",
      source: "dsh",
      dsh_plugin_id: "dsh-plugin-ccp",
    }),
  }).catch(() => {});
}
