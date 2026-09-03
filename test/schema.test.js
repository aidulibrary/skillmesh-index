import { describe, it, expect } from "vitest";
import { validateCapability } from "../functions/api/ccp/v1/lib/schema.js";

const validCapability = {
  id: "test-capability-001",
  name: "测试能力",
  name_en: "Test Capability",
  desc: "用于测试的能力锚点",
  desc_en: "A capability for testing",
  input: "text input",
  output: "text output",
  endpoint: "https://example.com/api/test",
  endpointType: "http",
  category: "test",
  features: ["feature1", "feature2"],
  features_en: ["feature1", "feature2"],
  tags: ["test"],
  dependencies: [],
  trustSource: 0.9,
  trustUsage: 0.5,
  trustUsageRate: 0.8,
  trustSuccess: 0.95,
  trustRisk: 0.1,
  trustTime: 0.85,
};

describe("validateCapability", () => {
  it("完整有效数据 → valid=true", () => {
    const result = validateCapability(validCapability);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("缺少必填字段 → 返回错误", () => {
    const result = validateCapability({});
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("缺失 id → 返回错误", () => {
    const { id, ...withoutId } = validCapability;
    const result = validateCapability(withoutId);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("id"))).toBe(true);
  });

  it("缺失 name → 返回错误", () => {
    const { name, ...withoutName } = validCapability;
    const result = validateCapability(withoutName);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("name"))).toBe(true);
  });

  it("id 格式不正确 → 返回错误", () => {
    const result = validateCapability({ ...validCapability, id: "invalid" });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("id format"))).toBe(true);
  });

  it("id 格式正确 → 通过", () => {
    const ids = [
      "abc-123",
      "pdf-extract-text-001",
      "seq-align-blast-101",
      "a-b-c-999",
    ];
    for (const id of ids) {
      const result = validateCapability({ ...validCapability, id });
      expect(result.valid).toBe(true);
    }
  });

  it("id 前缀不能包含大写字母", () => {
    const result = validateCapability({
      ...validCapability,
      id: "ABC-123",
    });
    expect(result.valid).toBe(false);
  });

  it("信任向量超出范围 → 返回错误", () => {
    const result = validateCapability({
      ...validCapability,
      trustSource: 1.5,
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("trust"))).toBe(true);
  });

  it("信任向量负值 → 返回错误", () => {
    const result = validateCapability({
      ...validCapability,
      trustSuccess: -0.1,
    });
    expect(result.valid).toBe(false);
  });

  it("空字符串必填字段 → 返回错误", () => {
    const result = validateCapability({
      ...validCapability,
      name: "   ",
    });
    expect(result.valid).toBe(false);
  });
});
