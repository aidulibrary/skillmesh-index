/**
 * CCP 客户端 SDK — CCP 协议 v1.0.0
 * ==================================
 * SkillMesh / 插台 能力通约协议（CCP）客户端库。
 * 封装 13 个 API 方法，简化 Agent / 应用接入。
 *
 * 使用方式（Node.js ≥18 或浏览器）：
 *   const { CCPClient } = require("@skillmesh-ccp/ccp-client");
 *   // 或 import { CCPClient } from "@skillmesh-ccp/ccp-client";
 *
 *   const client = new CCPClient({
 *     baseUrl: "https://skillmesh.礼字号.中国/api/ccp/v1",
 *     agentId: "my-agent",
 *     timeout: 15000,
 *   });
 *
 *   const caps = await client.listCapabilities();
 *   const found = await client.search("pdf");
 *
 * 版本：v1.0.0
 * 协议：CCP v1.0.0
 */

const DEFAULT_BASE_URL = "https://skillmesh.礼字号.中国/api/ccp/v1";
const DEFAULT_TIMEOUT = 15000;
const DEFAULT_AGENT_ID = "marvis";
const CCP_PROTOCOL = "CCP";
const CCP_VERSION = "v1.0.0";

/** 信任向量维度（顺序固定，供 getTrustVector 计算） */
const TRUST_DIMS = [
  "source",
  "usage",
  "usageRate",
  "success",
  "risk",
  "time",
  "evidence",
];

/**
 * 将能力锚点的信任字段归一化为 0-100 百分比
 * @param {object} cap - 能力锚点对象
 * @returns {object} { source, usage, usageRate, success, risk, time, evidence } 均为 0-100
 */
function computeTrustVector(cap) {
  if (!cap) return null;
  const clamp = (v) => Math.max(0, Math.min(100, Math.round((v ?? 0.5) * 100)));
  return {
    source: clamp(cap.trust_source),
    usage: clamp(cap.trust_usage),
    usageRate: clamp(cap.trust_usage_rate),
    success: clamp(cap.trust_success),
    risk: 100 - clamp(cap.trust_risk),
    time: clamp(cap.trust_time),
    evidence: clamp(
      cap.evidence && typeof cap.evidence.count === "number"
        ? Math.min(1, cap.evidence.count / 10)
        : 0,
    ),
  };
}

class CCPClient {
  /**
   * @param {object} [options]
   * @param {string} [options.baseUrl] - CCP API 根地址（默认 https://skillmesh.礼字号.中国/api/ccp/v1）
   * @param {number} [options.timeout] - 请求超时（毫秒，默认 15000）
   * @param {string} [options.agentId] - 调用方 Agent 标识（默认 marvis）
   */
  constructor(options = {}) {
    this.baseUrl = (options.baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.timeout = options.timeout || DEFAULT_TIMEOUT;
    this.agentId = options.agentId || DEFAULT_AGENT_ID;
    this.protocol = CCP_PROTOCOL;
    this.version = CCP_VERSION;
  }

  /**
   * 底层请求封装 — 统一超时 / JSON 解析 / 错误提升
   * @param {string} method - HTTP 方法
   * @param {string} path - API 路径（相对 baseUrl）
   * @param {object} [body] - JSON body
   * @returns {Promise<*>} 解析后的响应 JSON
   */
  async _request(method, path, body) {
    const url = `${this.baseUrl}${path}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);
    try {
      const res = await fetch(url, {
        method,
        headers: {
          Accept: "application/json",
          ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
          "X-CCP-Agent": this.agentId,
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
      const text = await res.text();
      let data = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch (_) {
        data = text;
      }
      if (!res.ok) {
        const err = new Error(
          (data && data.error && (data.error.message || data.error.code)) ||
            `CCP request failed: ${res.status}`,
        );
        err.status = res.status;
        err.code = data && data.error && data.error.code;
        err.response = data;
        throw err;
      }
      return data;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * 搜索能力锚点
   * @param {string} q - 搜索关键词
   * @param {object} [opts] - { federated?: boolean }
   * @returns {Promise<object>} { count, results }
   */
  async search(q, opts = {}) {
    const params = new URLSearchParams({ q });
    if (opts.federated) params.set("federated", "true");
    return this._request("GET", `/search?${params.toString()}`);
  }

  /** 获取能力详情 */
  async getCapability(id) {
    return this._request("GET", `/capabilities/${encodeURIComponent(id)}`);
  }

  /** 列出全部能力锚点 */
  async listCapabilities() {
    return this._request("GET", "/capabilities");
  }

  /** 生成指定框架适配器 */
  async getAdapter(id, fw) {
    return this._request(
      "GET",
      `/capabilities/${encodeURIComponent(id)}/adapters/${encodeURIComponent(fw)}`,
    );
  }

  /** 获取节点监控指标 */
  async getMetrics() {
    return this._request("GET", "/metrics");
  }

  /** 回传遥测数据 */
  async sendTelemetry(data) {
    return this._request("POST", "/telemetry", {
      ...data,
      agent_id: data.agent_id || this.agentId,
    });
  }

  /**
   * 查询遥测记录列表
   * @param {object} [params]
   * @param {"direct"|"dsh"} [params.source] - 按来源筛选
   * @param {string} [params.capability_id] - 按能力 ID 筛选
   * @param {number} [params.limit] - 返回条数限制（默认 20，最大 100）
   * @returns {Promise<object>} { records, summary }
   */
  async listTelemetry(params = {}) {
    const qs = new URLSearchParams();
    if (params.source) qs.set("source", params.source);
    if (params.capability_id) qs.set("capability_id", params.capability_id);
    if (params.limit) qs.set("limit", String(params.limit));
    const q = qs.toString();
    return this._request("GET", `/telemetry${q ? "?" + q : ""}`);
  }

  /**
   * 遥测中间件 — 自动回传调用结果到 CCP
   * @returns {{ after: (capabilityId: string, success: boolean, latencyMs?: number) => Promise<void> }}
   */
  telemetryMiddleware() {
    return {
      after: async (capabilityId, success, latencyMs) => {
        try {
          await this.sendTelemetry({
            capability_id: capabilityId,
            success,
            latency_ms: latencyMs,
          });
        } catch (_) {}
      },
    };
  }

  /** 提交社区贡献 */
  async contribute(data) {
    return this._request("POST", "/contribute", data);
  }

  /** 获取本节点信息 */
  async getNodeInfo() {
    return this._request("GET", "/federation");
  }

  /** 列出联邦节点 */
  async listNodes() {
    return this._request("GET", "/federation/nodes");
  }

  /** 注册联邦节点 */
  async addNode(data) {
    return this._request("POST", "/federation/nodes", data);
  }

  /** 删除联邦节点 */
  async removeNode(id) {
    return this._request(
      "DELETE",
      `/federation/nodes/${encodeURIComponent(id)}`,
    );
  }

  /** 交换索引摘要 */
  async exchangeIndex(data) {
    return this._request("POST", "/federation/exchange", data);
  }

  /**
   * 获取能力信任向量（由能力详情实时计算）
   * @param {string} id - 能力锚点 ID
   * @returns {Promise<object>} { capability_id, dimensions, vector }
   */
  async getTrustVector(id) {
    const cap = await this.getCapability(id);
    if (!cap || !cap.id) {
      const err = new Error(`Capability not found: ${id}`);
      err.code = "CAPABILITY_NOT_FOUND";
      err.status = 404;
      throw err;
    }
    const vector = computeTrustVector(cap);
    return {
      capability_id: cap.id,
      dimensions: TRUST_DIMS,
      vector,
    };
  }
}

module.exports = {
  CCPClient,
  computeTrustVector,
  TRUST_DIMS,
  DEFAULT_BASE_URL,
  DEFAULT_TIMEOUT,
};
