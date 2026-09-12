/**
 * S11 缺陷修复回归测试（D1–D7）
 * ==============================
 * 对应《S11-线上验收报告-20260912.md》第 6 节缺陷清单。
 * 运行：npx vitest run test/s11-fixes.test.js
 */
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { handleList } from "../functions/api/ccp/v1/handlers/capabilities.js";
import { handleStats } from "../functions/api/ccp/v1/handlers/health.js";
import { handleTrustPolicy } from "../functions/api/ccp/v1/federation/trust-policy.js";
import { onRequest } from "../functions/api/ccp/v1/[[path]].js";
import { onRequest as middlewareOnRequest } from "../functions/_middleware.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(path.join(ROOT, p), "utf8");

/** 统一 D1 mock：支持 COUNT(*) / 节点查询 / 分类分组 / 更新写入 */
function mockDB(node) {
  const stmt = (sql) => ({
    bind: () => stmt(sql),
    first: async () => {
      if (/COUNT\(\*\)/i.test(sql)) {
        if (/FROM capabilities/i.test(sql)) return { total: 33 };
        if (/FROM federation_nodes/i.test(sql)) return { total: 4 };
        if (/FROM contributors/i.test(sql)) return { total: 2 };
        if (/FROM telemetry_records/i.test(sql)) return { total: 5 };
        if (/FROM governance_proposals/i.test(sql)) return { total: 3 };
        return { total: 0 };
      }
      if (/FROM federation_nodes WHERE id = \?/i.test(sql)) return node;
      return null;
    },
    all: async () =>
      /GROUP BY category/i.test(sql)
        ? { results: [{ category: "数据处理", count: 12 }] }
        : { results: [] },
    run: async () => ({ success: true }),
  });
  return { prepare: (sql) => stmt(sql) };
}

const ctx = (method, url, body, env = {}) =>
  ({
    request: new Request(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
    env,
    waitUntil: () => {},
  });

// ================= D3：接口契约（/stats + 过滤）=================
describe("D3 接口契约与文档一致", () => {
  const NODE = { id: "bioinfo-ccp.lab.ac.cn", name: "BioInfo CCP Lab", trust_policy: null };

  it("D3-1 路由 /api/ccp/v1/stats 返回 200 且统计字段齐全（不再是 404）", async () => {
    const res = await onRequest(ctx("GET", "https://skillmesh.pages.dev/api/ccp/v1/stats", undefined, { skillmesh_db: mockDB(NODE) }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.stats).toMatchObject({
      capabilities: 33,
      federation_nodes: 4,
      contributors: 2,
      telemetries: 5,
      governance_proposals: 3,
    });
    expect(Array.isArray(body.categories)).toBe(true);
  });

  it("D3-1b db 缺失时 /stats 返回 500 DB_ERROR（语义为服务端错误而非路由缺失）", async () => {
    const res = await handleStats(null);
    expect(res.status).toBe(500);
    expect((await res.json()).error.code).toBe("DB_ERROR");
  });

  it("D3-2 ?q=pdf 过滤生效（返回子集而非全量 33）", async () => {
    const res = await onRequest(ctx("GET", "https://skillmesh.pages.dev/api/ccp/v1/capabilities?q=pdf"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.count).toBeGreaterThan(0);
    expect(body.count).toBeLessThan(33);
  });

  it("D3-3 ?category=数据处理 过滤生效", async () => {
    const res = await onRequest(ctx("GET", "https://skillmesh.pages.dev/api/ccp/v1/capabilities?category=%E6%95%B0%E6%8D%AE%E5%A4%84%E7%90%86"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.count).toBeGreaterThan(0);
    expect(body.count).toBeLessThan(33);
  });

  it("D3-4 不存在的分类返回 0（不再返回全量 33）", async () => {
    const res = await onRequest(ctx("GET", "https://skillmesh.pages.dev/api/ccp/v1/capabilities?category=%E4%B8%8D%E5%AD%98%E5%9C%A8%E5%88%86%E7%B1%BBXYZ"));
    const body = await res.json();
    expect(body.count).toBe(0);
  });

  it("D3-3b ?category=data 与中文别名等价", async () => {
    const cn = await (await onRequest(ctx("GET", "https://skillmesh.pages.dev/api/ccp/v1/capabilities?category=%E6%95%B0%E6%8D%AE%E5%A4%84%E7%90%86"))).json();
    const en = await (await onRequest(ctx("GET", "https://skillmesh.pages.dev/api/ccp/v1/capabilities?category=data"))).json();
    expect(en.count).toBe(cn.count);
    expect(en.count).toBeGreaterThan(0);
  });

  it("D3-5 无过滤时返回全量（本地无 DB 走静态回退；DB 路径的全量 33 见 D3-1）", async () => {
    const body = await (await handleList(null, {}, {})).json();
    const staticCount = (await import("../functions/_data/capabilities.js")).CAPABILITIES.length;
    expect(body.count).toBe(staticCount);
    expect(body.total).toBe(staticCount);
    expect(body.query).toBeNull();
    expect(body.category).toBeNull();
  });
});

// ================= D4：信任策略 PUT 校验 =================
describe("D4 信任策略 PUT 权重校验", () => {
  const NODE = { id: "bioinfo-ccp.lab.ac.cn", name: "BioInfo CCP Lab", trust_policy: null };
  const put = (body) =>
    onRequest(
      ctx(
        "PUT",
        "https://skillmesh.pages.dev/api/ccp/v1/federation/nodes/bioinfo-ccp.lab.ac.cn/trust-policy",
        body,
        { skillmesh_db: mockDB(NODE) },
      ),
    );

  it("D4-1 未知权重键 → 400 VALIDATION_ERROR", async () => {
    const res = await put({ weights: { source: 0.25, evil_key: 0.1 } });
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("VALIDATION_ERROR");
  });

  it("D4-2 权重和 ≠ 1 → 400", async () => {
    const res = await put({ weights: { source: 0.5, usage: 0.5, success: 0.5, risk: 0.5, time: 0.5 } });
    expect(res.status).toBe(400);
  });

  it("D4-3 权重越界（>1）→ 400", async () => {
    const res = await put({ weights: { source: 1.5, usage: 0, success: 0, risk: 0, time: -0.5 } });
    expect(res.status).toBe(400);
  });

  it("D4-4 权重为负 → 400", async () => {
    const res = await put({ weights: { source: -0.2, usage: 0.2, success: 0.4, risk: 0.3, time: 0.3 } });
    expect(res.status).toBe(400);
  });

  it("D4-5 未知 threshold 键 → 400", async () => {
    const res = await put({ thresholds: { min_trust: 0.3, bogus: 1 } });
    expect(res.status).toBe(400);
  });

  it("D4-6 合法权重（和=1）→ 200 updated:true", async () => {
    const res = await put({ weights: { source: 0.3, usage: 0.2, success: 0.3, risk: 0.1, time: 0.1 } });
    expect(res.status).toBe(200);
    expect((await res.json()).updated).toBe(true);
  });
});

// ================= D2：页脚国际化 =================
describe("D2 页脚链接国际化", () => {
  const i18nLines = read("js/i18n.js").split(/\r?\n/);
  const seg = (s, e) => i18nLines.slice(s, e).join("\n");
  const keySet = (t) => new Set([...t.matchAll(/^\s+([A-Za-z0-9_]+):\s*"/gm)].map((m) => m[1]));
  const zh = keySet(seg(5, 194));
  const en = keySet(seg(194, 385));
  const ja = keySet(seg(385, i18nLines.length));
  const html = read("index.html");
  const htmlKeys = [...new Set([...html.matchAll(/data-i18n="([^"]+)"/g)].map((m) => m[1]))];

  it("D2-1 zh/en/ja 键值数量一致", () => {
    expect(en.size).toBe(zh.size);
    expect(ja.size).toBe(zh.size);
  });

  it("D2-2 index.html 全部 data-i18n 键在三语中均存在", () => {
    for (const k of htmlKeys) {
      expect(zh.has(k), `zh 缺键 ${k}`).toBe(true);
      expect(en.has(k), `en 缺键 ${k}`).toBe(true);
      expect(ja.has(k), `ja 缺键 ${k}`).toBe(true);
    }
  });

  it("D2-3 页脚 4 个新增专用键在三语中均存在且非中文残留", () => {
    const keys = ["footerNavCapabilities", "footerNavNodes", "footerNavWhy", "footerNavNext"];
    for (const k of keys) {
      expect(zh.has(k) && en.has(k) && ja.has(k), `缺键 ${k}`).toBe(true);
    }
    const enText = seg(194, 385);
    expect(enText).toMatch(/footerNavCapabilities:\s*"Capabilities"/);
    expect(enText).toMatch(/footerNavWhy:\s*"Why an Experiment"/);
    const jaText = seg(385, i18nLines.length);
    expect(jaText).toMatch(/footerNavCapabilities:\s*"能力一覧"/);
  });

  it("D2-4 页脚 8 个链接均带 data-i18n 属性", () => {
    const footer = html.slice(html.lastIndexOf("footer-links"));
    const count = (footer.match(/data-i18n="/g) || []).length;
    expect(count).toBeGreaterThanOrEqual(8);
  });
});

// ================= D5：可访问性 =================
describe("D5 可访问性修复", () => {
  const html = read("index.html");
  const lightHtml = html.slice(0, html.indexOf('[data-theme="dark"]'));

  it("D5-1 浅色主题主色加深（不再使用 #6366f1 / #4f46e5）", () => {
    expect(lightHtml).not.toContain("#6366f1");
    expect(lightHtml).not.toContain("#4f46e5");
    expect(lightHtml).toContain("#4338ca");
  });

  it("D5-2 页面主体地标由 div#app 改为 main#app", () => {
    expect(html).toContain('<main id="app">');
    expect(html).not.toContain('<div id="app">');
    expect((html.match(/<\/main>/g) || []).length).toBe(1);
  });

  it("D5-3 次要灰/占位符对比度提升（dark-mode.css 浅色块用 #64748b，tokens 用 zinc-500）", () => {
    const dark = read("dark-mode.css");
    const lightDark = dark.slice(0, dark.indexOf('[data-theme="dark"]'));
    expect(lightDark).toContain("--text-muted: #64748b");
    expect(read("css/tokens.css")).toContain("--sm-fg-placeholder: var(--sm-zinc-500)");
  });

  it("D5-4 正文链接不再仅靠颜色区分（增加下划线规则）", () => {
    const css = read("css/style.css");
    expect(css).toMatch(/text-decoration:\s*underline/);
    expect(css).toContain("main p a");
    expect(css).toContain(".footer-links a");
  });

  it("D5-5 能力卡片可访问名与可见标题一致（aria-labelledby + card-title id）", () => {
    const app = read("js/app.js");
    expect(app).toContain("aria-labelledby");
    expect(app).toContain("card-title-");
  });

  const lum = (hex) => {
    const c = hex.replace("#", "");
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(c.slice(i, i + 2), 16) / 255);
    const f = (v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const ratio = (a, b) => {
    const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x);
    return (l1 + 0.05) / (l2 + 0.05);
  };

  it.each([
    ["#4338ca", "#eef2ff", 4.5],
    ["#4338ca", "#ffffff", 4.5],
    ["#4338ca", "#f8fafc", 4.5],
    ["#64748b", "#f8fafc", 4.5],
    ["#64748b", "#ffffff", 4.5],
    ["#71717a", "#fafafa", 4.5],
    ["#94a3b8", "#0f172a", 4.5],
  ])("D5-6 对比度 %s on %s ≥ %s:1", (fg, bg, min) => {
    const r = ratio(fg, bg);
    expect(Number(r.toFixed(2))).toBeGreaterThanOrEqual(min);
  });
});

// ================= D1：Swagger 本地化 =================
describe("D1 API 文档页不依赖 CDN", () => {
  it("D1-1 api-docs.html 不再引用 jsdelivr CDN", () => {
    expect(read("api-docs.html")).not.toContain("cdn.jsdelivr.net");
    expect(read("api-docs.html")).not.toMatch(/<script[^>]+https?:\/\//);
    expect(read("api-docs.html")).not.toMatch(/<link[^>]+https?:\/\//);
  });

  it("D1-2 api-docs.html 改引本地 /swagger/ 资源并带加载失败降级提示", () => {
    const h = read("api-docs.html");
    expect(h).toContain("/swagger/swagger-ui.css");
    expect(h).toContain("/swagger/swagger-ui-bundle.js");
    expect(h).toContain("Swagger UI 资源加载失败");
  });

  it("D1-3 部署根（pages_build_output_dir='.'）存在 swagger 三件套", () => {
    for (const f of [
      "swagger/swagger-ui.css",
      "swagger/swagger-ui-bundle.js",
      "swagger/swagger-ui-standalone-preset.js",
    ]) {
      const p = path.join(ROOT, f);
      expect(existsSync(p), `缺少 ${f}`).toBe(true);
      expect(statSync(p).size).toBeGreaterThan(1000);
    }
  });
});

// ================= D6 / D7：缓存与安全头 =================
describe("D6/D7 缓存策略与 HSTS", () => {
  const headers = read("_headers");

  it("D6-1 HTML 与根路径不再缓存 1 小时，改为 max-age=0, must-revalidate", () => {
    expect(headers).toMatch(/\/\*\.html[\s\S]{0,80}max-age=0, must-revalidate/);
    expect(headers).toMatch(/^\/\s*\n\s*Cache-Control: public, max-age=0, must-revalidate/m);
    expect(headers).not.toMatch(/\/\*\.html[\s\S]{0,80}max-age=3600/);
  });

  it("D6-2 /swagger/* 静态资源仍保持长缓存", () => {
    expect(headers).toMatch(/\/swagger\/\*[\s\S]{0,80}max-age=604800/);
  });

  // 构造中间件调用上下文（next 返回未带 Cache-Control 的 HTML 响应）
  const runMiddleware = (p) =>
    middlewareOnRequest({
      request: new Request("https://skillmesh.pages.dev" + p),
      next: async () =>
        new Response("<!doctype html><html><body>x</body></html>", {
          headers: { "Content-Type": "text/html; charset=utf-8" },
        }),
    });

  it("D6-3 _middleware 不再把 HTML 入口覆盖为 1 小时缓存", async () => {
    for (const p of ["/", "/index.html", "/health", "/health.html", "/api-docs"]) {
      const res = await runMiddleware(p);
      expect(res.headers.get("Cache-Control")).toBe("public, max-age=0, must-revalidate");
    }
    // 源码层兜底：中间件内不得再出现 1 小时缓存的字面量
    expect(read("functions/_middleware.js")).not.toContain("max-age=3600");
    expect(read("index.html")).not.toContain("max-age=3600");
  });

  it("D6-4 _middleware 未破坏静态资源/文档/API 的缓存分级", async () => {
    const asset = await runMiddleware("/js/app.js");
    expect(asset.headers.get("Cache-Control")).toBe("public, max-age=31536000, immutable");
    const doc = await runMiddleware("/docs/quickstart.md");
    expect(doc.headers.get("Cache-Control")).toBe("public, max-age=604800, stale-while-revalidate=86400");
    const api = await runMiddleware("/api/ccp/v1/capabilities");
    expect(api.headers.get("Cache-Control")).toBe("no-store");
    const icon = await runMiddleware("/favicon.ico");
    expect(icon.headers.get("Cache-Control")).toBeNull();
  });

  it("D7-1 _headers 已声明 HSTS", () => {
    expect(headers).toContain("Strict-Transport-Security");
    expect(headers).toMatch(/Strict-Transport-Security:\s*max-age=63072000/);
  });
});

// ================= 回归：既有测试不被破坏 =================
describe("回归基线", () => {
  it("能力列表原有字段结构不变", async () => {
    const body = await (await handleList(null, {}, {})).json();
    expect(body).toMatchObject({ protocol: "CCP", version: "v1.0.0" });
    expect(Array.isArray(body.capabilities)).toBe(true);
  });

  it("trust-policy GET 仍返回五维权重（和=1）", async () => {
    const NODE = { id: "n1", name: "Node 1", trust_policy: null };
    const res = await handleTrustPolicy(
      new Request("https://x/api/ccp/v1/federation/nodes/n1/trust-policy", { method: "GET" }),
      mockDB(NODE),
      "n1",
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    const sum = Object.values(body.policy.weights).reduce((a, b) => a + b, 0);
    expect(Number(sum.toFixed(2))).toBe(1);
  });
});
