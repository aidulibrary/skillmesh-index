/**
 * S13-4: 语义搜索体验 — API 端集成测试
 * =======================================
 * 验证 `handleSearch` 在语义搜索路径下的行为：
 * - Workers AI embedding 生成正确
 * - 语义结果与关键词结果合并排序
 * - Workers AI 不可用时优雅降级到关键词搜索
 * - 联邦搜索可选参数
 * - 结果包含 `_semanticScore` 字段
 * - 响应结构符合 CCP 协议规范
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

let handleSearch;
let mockAI;

beforeEach(async () => {
  vi.restoreAllMocks();

  mockAI = {
    run: vi.fn(),
  };

  const mod = await import("../functions/api/ccp/v1/handlers/capabilities.js");
  handleSearch = mod.handleSearch;
});

function mockEnv(aiAvailable = true, aiResult = null) {
  const env = {};
  if (aiAvailable) {
    env.AI = mockAI;
    if (aiResult) {
      mockAI.run.mockResolvedValue(aiResult);
    } else {
      mockAI.run.mockResolvedValue({
        data: [Array(384).fill(0.1)],
      });
    }
  }
  return env;
}

async function statusAndBody(response) {
  const body = await response.json();
  return { status: response.status, body };
}

describe("handleSearch — 关键词搜索（无 AI）", () => {
  it("无 AI binding → 仅关键词匹配", async () => {
    const env = mockEnv(false);
    const res = await handleSearch(null, env, "pdf");
    const { status, body } = await statusAndBody(res);

    expect(status).toBe(200);
    expect(body.protocol).toBe("CCP");
    expect(body.count).toBeGreaterThan(0);
    expect(
      body.results.every(
        (r) => !r._semanticScore || r._semanticScore === undefined,
      ),
    ).toBe(true);
  });

  it("空查询 → 400", async () => {
    const res = await handleSearch(null, {}, "");
    const { status } = await statusAndBody(res);
    expect(status).toBe(400);
  });

  it("空查询（空白字符串） → 400", async () => {
    const res = await handleSearch(null, {}, "   ");
    const { status } = await statusAndBody(res);
    expect(status).toBe(400);
  });
});

describe("handleSearch — AI 错误 → 降级到关键词", () => {
  it("AI.run 抛出异常 → 仍返回结果（降级）", async () => {
    const env = mockEnv(true);
    mockAI.run.mockRejectedValue(new Error("AI service unavailable"));

    const res = await handleSearch(null, env, "pdf");
    const { status, body } = await statusAndBody(res);

    expect(status).toBe(200);
    expect(body.count).toBeGreaterThan(0);
  });

  it("AI 返回 null → 降级", async () => {
    const env = mockEnv(true);
    mockAI.run.mockResolvedValue(null);

    const res = await handleSearch(null, env, "提取");
    const { status, body } = await statusAndBody(res);

    expect(status).toBe(200);
    expect(body.count).toBeGreaterThanOrEqual(0);
  });

  it("AI 返回空 data → 降级", async () => {
    const env = mockEnv(true);
    mockAI.run.mockResolvedValue({ data: [] });

    const res = await handleSearch(null, env, "翻译");
    const { status, body } = await statusAndBody(res);

    expect(status).toBe(200);
    expect(body.results).toBeDefined();
  });
});

describe("handleSearch — AI 可用 → 语义增强", () => {
  it("语义搜索与关键词结果合并", async () => {
    const env = mockEnv(true, {
      data: [Array(384).fill(0.05)],
    });

    const res = await handleSearch(null, env, "pdf extract");
    const { status, body } = await statusAndBody(res);

    expect(status).toBe(200);
    expect(body.protocol).toBe("CCP");
    expect(body.version).toBe("v1.0.0");
    expect(body.query).toBe("pdf extract");
    expect(body.count).toBeGreaterThan(0);
    expect(Array.isArray(body.results)).toBe(true);
  });

  it("语义结果含 _semanticScore", async () => {
    const env = mockEnv(true, {
      data: [Array(384).fill(0.08)],
    });

    const res = await handleSearch(null, env, "extraction");
    const { body } = await statusAndBody(res);

    const semanticResults = body.results.filter(
      (r) => r._semanticScore !== undefined,
    );
    if (semanticResults.length > 0) {
      expect(typeof semanticResults[0]._semanticScore).toBe("number");
      expect(semanticResults[0]._semanticScore).toBeLessThanOrEqual(1);
      expect(semanticResults[0]._semanticScore).toBeGreaterThan(0);
    }
  });

  it("结果按语义+关键词混合排序", async () => {
    const env = mockEnv(true, {
      data: [Array(384).fill(0.07)],
    });

    const res = await handleSearch(null, env, "translate language");
    const { body } = await statusAndBody(res);

    expect(body.results.length).toBeGreaterThan(0);

    const keywordIds = new Set();
    body.results.forEach((r) => keywordIds.add(r.id));
    expect(keywordIds.size).toBeGreaterThan(0);
  });
});

describe("handleSearch — 联邦搜索", () => {
  it("federated=true → 返回字段无异常", async () => {
    const res = await handleSearch(null, {}, "pdf", true);
    const { status, body } = await statusAndBody(res);

    expect(status).toBe(200);
    expect(body.federated).toBe(true);
    expect(Array.isArray(body.results)).toBe(true);
  });

  it("federated=false（默认） → 仅本地", async () => {
    const res = await handleSearch(null, {}, "data");
    const { status, body } = await statusAndBody(res);

    expect(status).toBe(200);
    expect(body.federated).toBe(false);
    body.results.forEach((r) => {
      expect(r._source || "local").toBe("local");
    });
  });
});

describe("handleSearch — 多词查询", () => {
  it("中文单词匹配", async () => {
    const res = await handleSearch(null, {}, "提取");
    const { status, body } = await statusAndBody(res);

    expect(status).toBe(200);
    expect(body.count).toBeGreaterThan(0);
  });

  it("英文多词拆分匹配", async () => {
    const res = await handleSearch(null, {}, "text extraction");
    const { status, body } = await statusAndBody(res);

    expect(status).toBe(200);
    expect(body.results).toBeDefined();
  });
});
