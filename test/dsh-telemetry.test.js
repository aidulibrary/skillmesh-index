/**
 * S15 DSH 遥测闭环测试
 * ===================
 * 验证 DSH→CCP 运行时遥测回传全链路：
 * 1. DSH adapter YAML 包含 telemetry 节
 * 2. telemetry POST 接受 source=dsh / 非法值回退
 * 3. GET /telemetry 遥测记录列表（分来源/总量统计）
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateAdapter } from "../functions/api/ccp/v1/handlers/adapters.js";
import {
  handleTelemetry,
  handleTelemetryList,
} from "../functions/api/ccp/v1/handlers/telemetry.js";

// ---- 数据库原始行格式（供 queryOne → mapRow 消费） ----
const mockDbRow = {
  id: "pdf-extract-text-001",
  name: "PDF 文本提取",
  name_en: "PDF Text Extraction",
  desc: "从 PDF 文件中提取文本内容",
  desc_en: "Extract text from PDF files",
  input: "https://example.com/sample.pdf",
  input_en: "https://example.com/sample.pdf",
  output: "text content string",
  output_en: "text content string",
  endpoint: "https://api.example.com/pdf/extract",
  endpoint_type: "http",
  category: "data",
  provenance: "https://github.com/example/pdf-tools",
  features: '["PDF 解析","文本提取","多语言支持"]',
  features_en: '["PDF Parser","Text Extract","Multi-language"]',
  trust_source: 0.85,
  trust_usage: 120,
  trust_usage_rate: 0.42,
  trust_success: 0.95,
  trust_risk: 0.2,
  trust_time: 0.88,
  evidence_count: 45,
  evidence_uncertainty: 0.38,
  evidence_staleness: 0.1,
  review_status: "approved",
  review_comments: null,
  version: 3,
  created_at: "2026-09-01T00:00:00Z",
  updated_at: "2026-09-15T10:00:00Z",
};

// ---- 应用层格式（mapRow 输出，供适配器消费） ----
const mockCapApp = {
  id: "pdf-extract-text-001",
  name: "PDF 文本提取",
  name_en: "PDF Text Extraction",
  desc: "从 PDF 文件中提取文本内容",
  category: "data",
  endpoint: "https://api.example.com/pdf/extract",
  endpointType: "http",
  input: "https://example.com/sample.pdf",
  features: ["PDF 解析", "文本提取", "多语言支持"],
  trustSource: 0.85,
  trustUsage: 120,
  trustUsageRate: 0.42,
  trustSuccess: 0.95,
  trustRisk: 0.2,
  trustTime: 0.88,
  evidence: { count: 45, uncertainty: 0.38 },
  provenance: "https://github.com/example/pdf-tools",
  version: 3,
  lastUpdated: "2026-09-15",
};

// ---- Mock helpers ----
let ipCount = 0;
function nextIp() {
  ipCount += 1;
  return `10.0.0.${ipCount}`;
}

function createMockRequest(body, method = "POST") {
  const ip = nextIp();
  return {
    method,
    url: "https://skillmesh.pages.dev/api/ccp/v1/telemetry",
    json: vi.fn().mockResolvedValue(body),
    headers: {
      get: vi.fn((k) => (k === "cf-connecting-ip" ? ip : null)),
    },
  };
}

function createMockDb(dbRow = mockDbRow) {
  return {
    prepare: vi.fn().mockReturnValue({
      bind: vi.fn().mockReturnThis(),
      all: vi.fn().mockResolvedValue({ results: dbRow ? [dbRow] : [] }),
      first: vi.fn().mockResolvedValue(dbRow),
      run: vi.fn().mockResolvedValue({}),
    }),
  };
}

// ============================================================
// 1. DSH 适配器遥测节验证
// ============================================================
describe("DSH adapter — telemetry section", () => {
  it("DSH YAML 包含 telemetry 节", () => {
    const result = generateAdapter(mockCapApp, "dsh");
    expect(result.type).toBe("yaml");
    expect(result.content).toContain("telemetry:");
    expect(result.content).toContain("endpoint:");
    expect(result.content).toContain("/api/ccp/v1/telemetry");
  });

  it("DSH YAML telemetry 节含 source=dsh", () => {
    const result = generateAdapter(mockCapApp, "dsh");
    expect(result.content).toContain("source:");
    expect(result.content).toContain('"dsh"');
  });

  it("DSH YAML telemetry 节含 dsh_plugin_id", () => {
    const result = generateAdapter(mockCapApp, "dsh");
    expect(result.content).toContain("dsh_plugin_id:");
    expect(result.content).toContain(mockCapApp.id);
  });

  it("DSH YAML telemetry endpoint 为完整 URL", () => {
    const result = generateAdapter(mockCapApp, "dsh");
    expect(result.content).toContain(
      "https://skillmesh.礼字号.中国/api/ccp/v1/telemetry",
    );
  });

  it("非 DSH 适配器（MCP）不含 telemetry 节", () => {
    const result = generateAdapter(mockCapApp, "mcp");
    expect(result.type).toBe("json");
    expect(result.content).not.toContain("telemetry:");
    expect(result.content).not.toContain("source: dsh");
  });
});

// ============================================================
// 2. Telemetry POST — source 字段验证
// ============================================================
describe("telemetry POST — source field", () => {
  let mockDb;

  beforeEach(() => {
    mockDb = createMockDb();
  });

  it("接受 source=direct（Agent 直传）", async () => {
    const req = createMockRequest({
      capability_id: "pdf-extract-text-001",
      agent_id: "my-agent",
      success: true,
      source: "direct",
      latency_ms: 50,
    });

    const resp = await handleTelemetry(req, mockDb, {});
    expect(resp.status).toBe(200);
    const data = await resp.json();
    expect(data.source).toBe("direct");
    expect(data.updated.evidence_count).toBeGreaterThan(0);
  });

  it("接受 source=dsh（DSH 插件回传）", async () => {
    const req = createMockRequest({
      capability_id: "pdf-extract-text-001",
      agent_id: "dsh-pdf-extract-text-001",
      success: true,
      source: "dsh",
      dsh_plugin_id: "pdf-extract-text-001",
      latency_ms: 75,
    });

    const resp = await handleTelemetry(req, mockDb, {});
    expect(resp.status).toBe(200);
    const data = await resp.json();
    expect(data.source).toBe("dsh");
    expect(data.dsh_plugin_id).toBe("pdf-extract-text-001");
  });

  it("非法 source 值回退为 direct", async () => {
    const req = createMockRequest({
      capability_id: "pdf-extract-text-001",
      agent_id: "my-agent",
      success: true,
      source: "hacker",
    });

    const resp = await handleTelemetry(req, mockDb, {});
    expect(resp.status).toBe(200);
    const data = await resp.json();
    expect(data.source).toBe("direct");
  });

  it("省略 source 字段默认为 direct", async () => {
    const req = createMockRequest({
      capability_id: "pdf-extract-text-001",
      agent_id: "my-agent",
      success: true,
    });

    const resp = await handleTelemetry(req, mockDb, {});
    const data = await resp.json();
    expect(data.source).toBe("direct");
  });

  it("遥测响应包含 evidence_count 更新", async () => {
    const req = createMockRequest({
      capability_id: "pdf-extract-text-001",
      agent_id: "my-agent",
      success: true,
    });

    const resp = await handleTelemetry(req, mockDb, {});
    const data = await resp.json();
    expect(data.updated.evidence_count).toBe(46); // 45 + 1
    expect(data.updated.evidence_uncertainty).toBeDefined();
  });

  it("失败的遥测也被记录", async () => {
    const req = createMockRequest({
      capability_id: "pdf-extract-text-001",
      agent_id: "my-agent",
      success: false,
    });

    const resp = await handleTelemetry(req, mockDb, {});
    expect(resp.status).toBe(200);
    const data = await resp.json();
    expect(data.success).toBe(false);
    expect(data.updated.trust_success).toBeLessThan(0.95);
  });

  it("不存在的 capId 返回 CAPABILITY_NOT_FOUND", async () => {
    const dbNoCap = createMockDb(null);
    const req = createMockRequest({
      capability_id: "nonexistent-999",
      agent_id: "my-agent",
      success: true,
    });

    const resp = await handleTelemetry(req, dbNoCap, {});
    expect(resp.status).toBe(404);
  });

  it("缺少 capability_id 返回 400", async () => {
    const req = createMockRequest({
      agent_id: "my-agent",
      success: true,
    });

    const resp = await handleTelemetry(req, mockDb, {});
    expect(resp.status).toBe(400);
  });

  it("缺少 agent_id 返回 400", async () => {
    const req = createMockRequest({
      capability_id: "pdf-extract-text-001",
      success: true,
    });

    const resp = await handleTelemetry(req, mockDb, {});
    expect(resp.status).toBe(400);
  });

  it("重复请求被限流（同 IP 同能力 1s 内）", async () => {
    // 使用固定 IP 构造限流场景
    const fixedIp = "1.1.1.1";
    const mkReq = (body) => ({
      method: "POST",
      url: "https://skillmesh.pages.dev/api/ccp/v1/telemetry",
      json: vi.fn().mockResolvedValue(body),
      headers: {
        get: vi.fn((k) => (k === "cf-connecting-ip" ? fixedIp : null)),
      },
    });

    const req1 = mkReq({
      capability_id: "pdf-extract-text-001",
      agent_id: "my-agent",
      success: true,
    });

    const resp1 = await handleTelemetry(req1, mockDb, {});
    expect(resp1.status).toBe(200);

    const req2 = mkReq({
      capability_id: "pdf-extract-text-001",
      agent_id: "my-agent",
      success: true,
    });
    const resp2 = await handleTelemetry(req2, mockDb, {});
    expect(resp2.status).toBe(429);
  });
});

// ============================================================
// 3. GET telemetry 列表端点
// ============================================================
describe("GET /telemetry — 遥测记录列表", () => {
  const mockRecords = [
    {
      id: 1,
      capability_id: "pdf-extract-text-001",
      agent_id: "dsh-pdf-extract-text-001",
      event_type: "invocation",
      success: 1,
      latency_ms: 75,
      source: "dsh",
      dsh_plugin_id: "pdf-extract-text-001",
      trace_id: null,
      created_at: "2026-09-17T10:00:00Z",
    },
    {
      id: 2,
      capability_id: "web-scrape-003",
      agent_id: "my-agent",
      event_type: "invocation",
      success: 1,
      latency_ms: 120,
      source: "direct",
      dsh_plugin_id: null,
      trace_id: null,
      created_at: "2026-09-17T09:30:00Z",
    },
    {
      id: 3,
      capability_id: "translate-zh-en-001",
      agent_id: "dsh-translate-zh-en-001",
      event_type: "error",
      success: 0,
      latency_ms: 2000,
      source: "dsh",
      dsh_plugin_id: "translate-zh-en-001",
      trace_id: null,
      created_at: "2026-09-17T08:00:00Z",
    },
  ];

  function listMockDb(rows, countResult = { total: 3 }) {
    return {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        all: vi.fn().mockResolvedValue({ results: rows }),
        first: vi.fn().mockResolvedValue(countResult),
      }),
    };
  }

  it("返回所有遥测记录及其统计", async () => {
    const db = listMockDb(mockRecords, { total: 3 });
    const resp = await handleTelemetryList(
      db,
      "https://skillmesh.pages.dev/api/ccp/v1/telemetry",
    );
    expect(resp.status).toBe(200);
    const data = await resp.json();
    expect(data.records.length).toBe(3);
    expect(data.summary.total).toBe(3);
  });

  it("按 source=dsh 筛选", async () => {
    const dshRecords = mockRecords.filter((r) => r.source === "dsh");
    const db = listMockDb(dshRecords, { total: 2 });
    const resp = await handleTelemetryList(
      db,
      "https://skillmesh.pages.dev/api/ccp/v1/telemetry?source=dsh",
    );
    const data = await resp.json();
    expect(data.records.length).toBe(2);
    data.records.forEach((r) => expect(r.source).toBe("dsh"));
  });

  it("按 source=direct 筛选", async () => {
    const directRecords = mockRecords.filter((r) => r.source === "direct");
    const db = listMockDb(directRecords, { total: 1 });
    const resp = await handleTelemetryList(
      db,
      "https://skillmesh.pages.dev/api/ccp/v1/telemetry?source=direct",
    );
    const data = await resp.json();
    data.records.forEach((r) => expect(r.source).toBe("direct"));
  });

  it("无 DB 时返回 DB_ERROR", async () => {
    const resp = await handleTelemetryList(
      null,
      "https://skillmesh.pages.dev/api/ccp/v1/telemetry",
    );
    expect(resp.status).toBe(500);
  });

  it("records 字段映射正确（success bool, source string）", async () => {
    const db = listMockDb(mockRecords, { total: 3 });
    const resp = await handleTelemetryList(
      db,
      "https://skillmesh.pages.dev/api/ccp/v1/telemetry",
    );
    const data = await resp.json();
    expect(typeof data.records[0].success).toBe("boolean");
    expect(typeof data.records[0].source).toBe("string");
    expect(data.records[0].dsh_plugin_id).toBe("pdf-extract-text-001");
  });

  it("limit 参数控制返回条数", async () => {
    const db = listMockDb(mockRecords.slice(0, 1), { total: 3 });
    const resp = await handleTelemetryList(
      db,
      "https://skillmesh.pages.dev/api/ccp/v1/telemetry?limit=1",
    );
    const data = await resp.json();
    expect(data.records.length).toBe(1);
  });
});
