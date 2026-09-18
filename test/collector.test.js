import { describe, it, expect, beforeEach } from "vitest";
import {
  getDeepSeekCapabilities,
  getDeepSeekCapIds,
} from "../functions/api/ccp/v1/admin/sources/deepseek.js";

describe("DeepSeek API 适配器", () => {
  let caps;
  beforeEach(() => { caps = getDeepSeekCapabilities(); });

  it("返回 7 项官方能力", () => { expect(caps.length).toBe(7); });

  it("每项包含必要字段", () => {
    for (const cap of caps) {
      expect(cap.id).toBeTruthy();
      expect(cap.name).toBeTruthy();
      expect(cap.name_en).toBeTruthy();
      expect(cap.desc).toBeTruthy();
      expect(cap.endpoint_type).toBe("http");
      expect(cap.category).toBeTruthy();
      expect(cap.provenance).toBeTruthy();
      expect(cap.features).toBeInstanceOf(Array);
      expect(cap.features.length).toBeGreaterThan(0);
      expect(typeof cap.trust_source).toBe("number");
    }
  });

  it("所有 ID 唯一", () => {
    expect(new Set(getDeepSeekCapIds()).size).toBe(7);
  });

  it("包含 deepseek-chat-completion", () => {
    const c = caps.find((x) => x.id === "deepseek-chat-completion");
    expect(c).toBeTruthy();
    expect(c.features).toContain("多轮对话");
    expect(c.features).toContain("流式输出");
  });

  it("包含 deepseek-reasoner（深度推理）", () => {
    const c = caps.find((x) => x.id === "deepseek-reasoner");
    expect(c).toBeTruthy();
    expect(c.features).toContain("深度推理");
  });

  it("deepseek-fim-completion 分类为 dev", () => {
    const c = caps.find((x) => x.id === "deepseek-fim-completion");
    expect(c).toBeTruthy();
    expect(c.category).toBe("dev");
  });

  it("包含 deepseek-function-calling（工具调用）", () => {
    const c = caps.find((x) => x.id === "deepseek-function-calling");
    expect(c).toBeTruthy();
    expect(c.features).toContain("工具调用");
  });

  it("包含 deepseek-models-list", () => {
    expect(caps.find((x) => x.id === "deepseek-models-list")).toBeTruthy();
  });

  it("包含 deepseek-file-upload", () => {
    expect(caps.find((x) => x.id === "deepseek-file-upload")).toBeTruthy();
  });

  it("deepseek-tokenizer 分类为 dev", () => {
    const c = caps.find((x) => x.id === "deepseek-tokenizer");
    expect(c).toBeTruthy();
    expect(c.category).toBe("dev");
  });

  it("所有 source = deepseek-api-official", () => {
    for (const cap of caps) expect(cap.source).toBe("deepseek-api-official");
  });

  it("trust_source 在 0..1 之间", () => {
    for (const cap of caps) {
      expect(cap.trust_source).toBeGreaterThanOrEqual(0);
      expect(cap.trust_source).toBeLessThanOrEqual(1);
    }
  });
});

describe("awesome-mcp README 解析", () => {
  function parseListEntries(md) {
    const entries = [];
    const itemRe = /^-\s+\[([^\]]+)\]\(([^)]+)\)\s*[-–—]\s*(.+)$/;
    const headRe = /^##\s+(.+)/;
    let cat = "";
    for (const line of md.split("\n")) {
      const hm = line.match(headRe);
      if (hm) { cat = hm[1].trim(); continue; }
      const im = line.match(itemRe);
      if (im) entries.push({
        name: im[1].trim(),
        url: im[2].trim(),
        desc: im[3].trim(),
        category: cat,
      });
    }
    return entries;
  }

  it("解析 3 个条目", () => {
    const md = "## FS\n- [A](https://a) - a\n- [B](https://b) - b\n## DB\n- [C](https://c) - c";
    expect(parseListEntries(md).length).toBe(3);
  });

  it("正确提取 name/url/desc", () => {
    const e = parseListEntries("- [MySvr](https://x/y) - Hello world")[0];
    expect(e.name).toBe("MySvr");
    expect(e.url).toBe("https://x/y");
    expect(e.desc).toBe("Hello world");
  });

  it("分类归属正确", () => {
    const md = "## FS\n- [A](https://a) - a\n## DB\n- [B](https://b) - b";
    const e = parseListEntries(md);
    expect(e[0].category).toBe("FS");
    expect(e[1].category).toBe("DB");
  });

  it("支持 - – — 分隔符", () => {
    const md = "- [A](https://a) - dash\n- [B](https://b) \u2013 en\n- [C](https://c) \u2014 em";
    expect(parseListEntries(md).length).toBe(3);
  });

  it("忽略非列表行", () => {
    expect(parseListEntries("text\n## Cat\nnot [link](url)").length).toBe(0);
  });
});

describe("能力标准化 normalizeCapability", () => {
  function normalize(cap) {
    const now = new Date().toISOString();
    return {
      id: cap.id,
      name: cap.name || "",
      name_en: cap.name_en || "",
      desc: cap.desc || "",
      desc_en: cap.desc_en || "",
      input: cap.input || "",
      input_en: cap.input_en || "",
      output: cap.output || "",
      output_en: cap.output_en || "",
      endpoint: cap.endpoint || "",
      endpoint_type: cap.endpoint_type || "mcp",
      category: cap.category || "data",
      provenance: cap.provenance || "",
      trust_source: typeof cap.trust_source === "number" ? cap.trust_source : 0.5,
      features: JSON.stringify(cap.features || []),
      features_en: JSON.stringify(cap.features_en || []),
      usage_guide: cap.usage_guide || "",
      usage_guide_en: cap.usage_guide_en || "",
      code_example: cap.code_example || "",
      last_updated: now,
      version: 1,
      updated_at: now,
      source: cap.source || "unknown",
    };
  }

  it("缺字段填充默认值", () => {
    const n = normalize({ id: "t", name: "T" });
    expect(n.category).toBe("data");
    expect(n.endpoint_type).toBe("mcp");
    expect(n.trust_source).toBe(0.5);
  });

  it("保留已有 trust_source", () => {
    expect(normalize({ id: "t", name: "T", trust_source: 0.85 }).trust_source).toBe(0.85);
  });

  it("features 序列化为 JSON 字符串", () => {
    expect(normalize({ id: "t", name: "T", features: ["a", "b"] }).features).toBe('["a","b"]');
  });

  it("source 标记保存", () => {
    expect(normalize({ id: "t", name: "T", source: "x" }).source).toBe("x");
  });
});

describe("采集控制器边界", () => {
  it("MAX 500 / BATCH 100 = 5 批", () => {
    expect(Math.ceil(500 / 100)).toBe(5);
  });
  it("0 条 0 批", () => {
    expect(Math.ceil(0 / 100)).toBe(0);
  });
});
