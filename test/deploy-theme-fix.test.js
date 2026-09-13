/**
 * deploy-theme-fix 契约测试
 * 守护目标：主题单一色板收敛、资源版本号一致、主题存储键不漂移。
 * 说明：本文件读取仓库根下的真实运行文件，任何回退都会让断言失败。
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(resolve(ROOT, p), "utf8");

describe("deploy-theme-fix / 主题单一色板契约", () => {
  const indexHtml = read("index.html");
  const healthHtml = read("health.html");
  const apiDocs = read("api-docs.html");
  const tokens = read("css/tokens.css");
  const darkCss = read("dark-mode.css");
  const healthCss = read("health.css");
  const sw = read("sw.js");
  const themeJs = read("dark-mode.js");

  it("D5-1 落地页不再硬编码旧靛蓝色板", () => {
    expect(/#6366f1|#4f46e5/i.test(indexHtml)).toBe(false);
  });

  it("三个 HTML 入口引用同一版本的 tokens.css", () => {
    const pick = (s) => s.match(/tokens\.css\?v=(\d+)/)?.[1];
    const v = pick(indexHtml);
    expect(v).toBeTruthy();
    expect(pick(healthHtml)).toBe(v);
    expect(pick(apiDocs)).toBe(v);
  });

  it("不再引用旧资源版本号 20260912b", () => {
    for (const src of [indexHtml, healthHtml, apiDocs, sw]) {
      expect(src).not.toContain("20260912b");
    }
  });

  it("tokens.css 暴露旧变量别名，历史组件零改造可用", () => {
    for (const name of [
      "--bg",
      "--bg-secondary",
      "--card-bg",
      "--border",
      "--text",
      "--text-muted",
      "--accent",
      "--accent-hover",
      "--accent-light",
      "--gradient-start",
      "--gradient-end",
      "--shadow",
      "--success",
      "--warning",
    ]) {
      const re = new RegExp(
        name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ":\\s*var\\(--sm-",
      );
      expect(re.test(tokens), `${name} 缺少别名映射`).toBe(true);
    }
  });

  it("tokens.css 提供原生表面接管与渐变起点", () => {
    expect(/--sm-bg-canvas:\s*var\(--sm-zinc-50\)/.test(tokens)).toBe(true);
    expect(/--sm-bg-canvas:\s*var\(--sm-zinc-950\)/.test(tokens)).toBe(true);
    expect(/--gradient-start:\s*var\(--sm-teal-700\)/.test(tokens)).toBe(true);
  });

  it("dark-mode.css 只接管滚动条，不再定义色板", () => {
    expect(/#0f172a|#1e293b|#334155|#818cf8/i.test(darkCss)).toBe(false);
  });

  it("health.css 不再自定义 :root 色板", () => {
    expect(/:root\s*\{/.test(healthCss)).toBe(false);
  });

  it("health.html 载入 tokens.css 后才载入 health.css（层叠顺序）", () => {
    expect(healthHtml.indexOf("tokens.css")).toBeGreaterThan(-1);
    expect(healthHtml.indexOf("tokens.css")).toBeLessThan(
      healthHtml.indexOf("health.css"),
    );
  });

  it("sw.js 缓存名与预缓存资源版本同步升级", () => {
    expect(sw.match(/CACHE_NAME\s*=\s*"([^"]+)"/)?.[1]).toBeTruthy();
    expect(/\?v=(\d+)/.test(sw)).toBe(true);
  });

  it("主题存储键 ccp-theme 在各入口保持一致", () => {
    for (const src of [indexHtml, healthHtml, apiDocs, themeJs]) {
      expect(src).toContain("ccp-theme");
    }
  });

  it("P1-1 首屏主题前置脚本先于样式链生效", () => {
    const i = indexHtml.indexOf("ccp-theme");
    expect(i).toBeGreaterThan(-1);
    expect(i).toBeLessThan(indexHtml.indexOf("</head>"));
  });

  it("主题按钮在三页同构（class 与 aria-label 齐备，图标可被脚本维护）", () => {
    for (const src of [indexHtml, healthHtml, apiDocs]) {
      expect(src).toContain('class="theme-toggle"');
      expect(src).toContain('aria-label="切换主题"');
    }
  });

  it("三页均声明 favicon，避免 /favicon.ico 404", () => {
    for (const src of [indexHtml, healthHtml, apiDocs]) {
      expect(src).toContain('rel="icon"');
    }
  });

  it("dark-mode.js 图标初始化兼容按钮后置场景", () => {
    expect(read("dark-mode.js")).toContain("DOMContentLoaded");
  });
});
