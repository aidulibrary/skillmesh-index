import { describe, it, expect, vi } from "vitest";
import { createTools, telemetryWrapper } from "../src/tools.js";
import { apply } from "../src/index.js";

describe("CCP Search", () => {
  it("正常搜索返回摘要列表", async () => {
    const mockClient = {
      search: async () => ({
        results: [
          { id: "pdf-001", name: "PDF Extract", name_en: "PDF Extract", desc: "Extracts PDF text",
            category: "data", endpointType: "http", trustSource: 0.8, trustUsageRate: 0.7,
            trustSuccess: 0.9, trustRisk: 0.3, trustTime: 0.6 },
        ],
      }),
    };
    const tools = createTools();
    tools.client.search = mockClient.search;
    const result = await tools.ccp_search("pdf");
    expect(result.count).toBe(1);
    expect(result.results[0].id).toBe("pdf-001");
    expect(result.results[0].trust.source).toBe(0.8);
  });

  it("API 错误返回 error 和空列表", async () => {
    const tools = createTools();
    tools.client.search = async () => ({ error: { code: "SEARCH_ERROR", detail: "down" } });
    const result = await tools.ccp_search("xyz");
    expect(result.error).toBeTruthy();
    expect(result.count).toBe(0);
  });
});

describe("CCP Detail", () => {
  it("获取详情含适配器", async () => {
    const tools = createTools();
    tools.client.detail = async () => ({ id: "pdf-001", name: "PDF Extract", trust_source: 0.8 });
    tools.client.adapter = async () => ({ adapter: "name: pdf-001\ntype: tool" });
    const result = await tools.ccp_detail("pdf-001");
    expect(result.id).toBe("pdf-001");
    expect(result.adapter).toContain("name: pdf-001");
  });

  it("不存在的 ID 返回 NOT_FOUND", async () => {
    const tools = createTools();
    tools.client.detail = async () => null;
    tools.client.adapter = async () => null;
    const result = await tools.ccp_detail("nonexistent");
    expect(result.error.code).toBe("NOT_FOUND");
  });
});

describe("CCP Telemetry", () => {
  it("成功回传返回 acknowledged", async () => {
    const tools = createTools();
    tools.client.telemetry = async () => ({});
    const result = await tools.ccp_telemetry("pdf-001", true, 100);
    expect(result.acknowledged).toBe(true);
  });

  it("回传失败返回 error", async () => {
    const tools = createTools();
    tools.client.telemetry = async () => ({ error: { code: "TELEMETRY_ERROR" } });
    const result = await tools.ccp_telemetry("pdf-001", false, 200);
    expect(result.acknowledged).toBe(false);
  });
});

describe("telemetryWrapper", () => {
  it("同步调用成功自动回传", () => {
    const result = telemetryWrapper(() => "ok", "test-001");
    expect(result).toBe("ok");
  });

  it("同步调用失败自动回传并抛出", () => {
    expect(() => telemetryWrapper(() => { throw new Error("fail"); }, "test-001")).toThrow("fail");
  });

  it("异步调用成功自动回传", async () => {
    const result = await telemetryWrapper(() => Promise.resolve("ok"), "test-002");
    expect(result).toBe("ok");
  });

  it("异步调用失败自动回传并抛出", async () => {
    await expect(telemetryWrapper(() => Promise.reject(new Error("fail")), "test-002")).rejects.toThrow("fail");
  });
});

describe("Cordis 入口", () => {
  it("apply 注册 3 个服务", () => {
    const services = {};
    const ctx = {
      provide(name, impl) { services[name] = impl; },
      on() {},
    };
    apply(ctx, { federated: false });
    expect(Object.keys(services)).toEqual(["ccp_search", "ccp_detail", "ccp_telemetry"]);
    expect(typeof services.ccp_search).toBe("function");
    expect(typeof services.ccp_detail).toBe("function");
    expect(typeof services.ccp_telemetry).toBe("function");
  });
});
