import { describe, it, expect } from "vitest";
import {
  structuredError,
  ERROR_CODES,
  ERROR_LIST,
  DEFAULT_CODE_BY_STATUS,
} from "../functions/api/ccp/v1/lib/errors.js";

async function parseResponse(response) {
  const text = await response.text();
  return JSON.parse(text);
}

describe("ERROR_CODES", () => {
  it("包含 13 种错误码", () => {
    const codes = Object.keys(ERROR_CODES);
    expect(codes).toHaveLength(13);
  });

  it("每种错误码包含 status / message / message_en", () => {
    for (const [code, def] of Object.entries(ERROR_CODES)) {
      expect(def.status).toBeTypeOf("number");
      expect(def.message).toBeTypeOf("string");
      expect(def.message_en).toBeTypeOf("string");
    }
  });

  it("ERROR_LIST 与 ERROR_CODES 键一致", () => {
    expect([...ERROR_LIST].sort()).toEqual(Object.keys(ERROR_CODES).sort());
  });

  it("ERROR_LIST 不可变", () => {
    expect(() => ERROR_LIST.push("NEW_CODE")).toThrow();
  });
});

describe("structuredError", () => {
  it("已知错误码 → 返回结构化错误", async () => {
    const result = structuredError("CAPABILITY_NOT_FOUND");
    expect(result.status).toBe(404);
    const body = await parseResponse(result);
    expect(body.error.code).toBe("CAPABILITY_NOT_FOUND");
    expect(body.error.message).toBe("能力锚点不存在");
    expect(body.error.message_en).toBe("Capability not found");
  });

  it("未知错误码 → 降级为 INTERNAL_ERROR", async () => {
    const result = structuredError("UNKNOWN_CODE");
    expect(result.status).toBe(500);
    const body = await parseResponse(result);
    expect(body.error.code).toBe("INTERNAL_ERROR");
  });

  it("detail 传入 → 附加到响应体", async () => {
    const result = structuredError("CAPABILITY_NOT_FOUND", {
      detail: { id: "test-001" },
    });
    const body = await parseResponse(result);
    expect(body.error.detail).toEqual({ id: "test-001" });
  });

  it("响应头包含 JSON Content-Type", () => {
    const result = structuredError("CAPABILITY_NOT_FOUND");
    const ct = result.headers.get("Content-Type");
    expect(ct).toMatch(/application\/json/);
  });

  it("响应头包含 CORS", () => {
    const result = structuredError("CAPABILITY_NOT_FOUND");
    const acao = result.headers.get("Access-Control-Allow-Origin");
    expect(acao).toBe("*");
  });

  it("所有 13 种错误码均可生成有效响应", async () => {
    for (const code of ERROR_LIST) {
      const result = structuredError(code);
      expect(result).toBeInstanceOf(Response);
      expect(result.status).toBeGreaterThanOrEqual(400);
      const body = await parseResponse(result);
      expect(body.error).toBeDefined();
      expect(body.error.code).toBeDefined();
    }
  });
});

describe("DEFAULT_CODE_BY_STATUS", () => {
  it("400 → VALIDATION_ERROR", () => {
    expect(DEFAULT_CODE_BY_STATUS[400]).toBe("VALIDATION_ERROR");
  });

  it("401 → UNAUTHORIZED", () => {
    expect(DEFAULT_CODE_BY_STATUS[401]).toBe("UNAUTHORIZED");
  });

  it("404 → CAPABILITY_NOT_FOUND", () => {
    expect(DEFAULT_CODE_BY_STATUS[404]).toBe("CAPABILITY_NOT_FOUND");
  });

  it("500 → INTERNAL_ERROR", () => {
    expect(DEFAULT_CODE_BY_STATUS[500]).toBe("INTERNAL_ERROR");
  });
});
