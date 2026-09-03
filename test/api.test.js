import { describe, it, expect } from "vitest";
import { generateAdapter } from "../functions/api/ccp/v1/handlers/adapters.js";
import { getNodeInfo } from "../functions/api/ccp/v1/federation/node.js";
import { jsonResponse } from "../functions/api/ccp/v1/lib/response.js";
import { structuredError } from "../functions/api/ccp/v1/lib/errors.js";

const capabilities = [
  {
    id: "pdf-extract-text-001",
    name: "PDF文本提取",
    name_en: "PDF Text Extraction",
    desc: "从PDF文件中提取全部文本内容",
    desc_en: "Extract all text from PDF",
    input: "PDF file",
    output: "Extracted text",
    category: "data",
    endpoint: "https://example.com/pdf",
    endpointType: "http",
    trustSource: 0.92,
    trustUsage: 1200,
    trustUsageRate: 0.78,
    trustSuccess: 0.97,
    trustRisk: 0.1,
    trustTime: 0.88,
    features: ["保留段落结构"],
    features_en: ["Paragraph structure"],
    tags: ["pdf", "text"],
    version: "1.0.0",
    status: "active",
  },
  {
    id: "web-scrape-003",
    name: "网页内容抓取",
    name_en: "Web Scraping",
    desc: "抓取网页内容并提取结构化数据",
    desc_en: "Scrape web pages",
    input: "URL",
    output: "Structured data",
    category: "data",
    endpoint: "https://example.com/scrape",
    endpointType: "http",
    trustSource: 0.85,
    trustUsage: 800,
    trustUsageRate: 0.6,
    trustSuccess: 0.9,
    trustRisk: 0.2,
    trustTime: 0.8,
    features: ["支持动态页面"],
    features_en: ["Dynamic page support"],
    tags: ["web", "scrape"],
    version: "1.0.0",
    status: "active",
  },
];

describe("generateAdapter", () => {
  it("DSH 框架 → 返回 YAML", () => {
    const result = generateAdapter(capabilities[0], "dsh");
    expect(result).toBeDefined();
    expect(result.type).toBe("yaml");
    expect(result.content).toContain("pdf-extract-text-001");
  });

  it("MCP 框架 → 返回 JSON（含 mcpServers）", () => {
    const result = generateAdapter(capabilities[0], "mcp");
    expect(result).toBeDefined();
    const parsed = JSON.parse(result.content);
    expect(parsed.mcpServers).toBeDefined();
    expect(parsed.mcpServers["pdf-extract-text-001"]).toBeDefined();
  });

  it("LangChain 框架 → 返回 JSON（含 type: function）", () => {
    const result = generateAdapter(capabilities[0], "langchain");
    expect(result).toBeDefined();
    const parsed = JSON.parse(result.content);
    expect(parsed.type).toBe("function");
  });

  it("CrewAI 框架 → 返回 JSON", () => {
    const result = generateAdapter(capabilities[0], "crewai");
    expect(result).toBeDefined();
    const parsed = JSON.parse(result.content);
    expect(parsed.name).toBeDefined();
  });

  it("Dify 框架 → 返回 YAML", () => {
    const result = generateAdapter(capabilities[0], "dify");
    expect(result).toBeDefined();
    expect(result.type).toBe("yaml");
    expect(result.content).toContain("Dify");
  });

  it("不支持的框架 → 返回 null", () => {
    const result = generateAdapter(capabilities[0], "unsupported");
    expect(result).toBeNull();
  });
});

describe("getNodeInfo", () => {
  it("返回节点信息（含 node 对象）", () => {
    const env = { SITE_NAME: "SkillMesh", SITE_VERSION: "1.0.0" };
    const info = getNodeInfo(env);
    expect(info.protocol).toBe("CCP");
    expect(info.version).toBe("v1.0.0");
    expect(info.node).toBeDefined();
    expect(info.node.name).toBe("SkillMesh 主节点");
    expect(info.node.features).toContain("search");
    expect(info.node.federation_policy).toBe("manual");
  });

  it("默认值", () => {
    const info = getNodeInfo({});
    expect(info.node).toBeDefined();
    expect(info.protocol).toBe("CCP");
  });
});

describe("jsonResponse", () => {
  it("返回 JSON 响应", async () => {
    const response = jsonResponse({ test: true });
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("application/json");
    const body = await response.json();
    expect(body.test).toBe(true);
  });

  it("自定义状态码", () => {
    const response = jsonResponse({ error: "test" }, 201);
    expect(response.status).toBe(201);
  });
});

describe("structuredError", () => {
  it("CAPABILITY_NOT_FOUND → 404", () => {
    const response = structuredError("CAPABILITY_NOT_FOUND");
    expect(response.status).toBe(404);
  });

  it("RATE_LIMITED → 429", () => {
    const response = structuredError("RATE_LIMITED");
    expect(response.status).toBe(429);
  });

  it("INTERNAL_ERROR → 500", () => {
    const response = structuredError("INTERNAL_ERROR");
    expect(response.status).toBe(500);
  });
});
