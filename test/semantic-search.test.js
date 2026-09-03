import { describe, it, expect } from "vitest";

describe("cosineSimilarity (inline)", () => {
  function cosineSimilarity(a, b) {
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  it("相同向量 → 1.0", () => {
    const v = [1, 2, 3];
    expect(cosineSimilarity(v, v)).toBeCloseTo(1, 5);
  });

  it("正交向量 → 0", () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBe(0);
  });

  it("零向量 → 0", () => {
    expect(cosineSimilarity([0, 0], [1, 1])).toBe(0);
  });

  it("负数向量 → 正确计算", () => {
    const result = cosineSimilarity([1, -1], [-1, 1]);
    expect(result).toBeCloseTo(-1, 5);
  });
});

describe("buildCapText (inline)", () => {
  function buildCapText(cap) {
    return [
      cap.name || "",
      cap.name_en || "",
      cap.desc || "",
      cap.desc_en || "",
      ...(cap.features || []),
      ...(cap.features_en || []),
      cap.category || "",
    ]
      .filter(Boolean)
      .join(" ");
  }

  it("完整能力锚点 → 拼接所有字段", () => {
    const cap = {
      name: "PDF文本提取",
      name_en: "PDF Text Extraction",
      desc: "从PDF中提取文本",
      desc_en: "Extract text from PDF",
      features: ["保留段落结构", "页码映射"],
      features_en: ["Paragraph structure", "Page mapping"],
      category: "data",
    };
    const text = buildCapText(cap);
    expect(text).toContain("PDF文本提取");
    expect(text).toContain("PDF Text Extraction");
    expect(text).toContain("保留段落结构");
    expect(text).toContain("Paragraph structure");
    expect(text).toContain("data");
  });

  it("空字段不包含", () => {
    const cap = {
      name: "Test",
      name_en: "",
      desc: "",
      desc_en: "",
      features: [],
      features_en: [],
      category: "",
    };
    const text = buildCapText(cap);
    expect(text).toBe("Test");
  });

  it("缺失字段不影响", () => {
    const cap = { name: "Only" };
    const text = buildCapText(cap);
    expect(text).toBe("Only");
  });
});
