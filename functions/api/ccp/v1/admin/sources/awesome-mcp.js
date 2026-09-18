/**
 * S18 能力采集引擎 — awesome-mcp-servers 社区列表适配器
 * ======================================================
 *
 * 从 awesome-mcp-servers（GitHub 上最全面的 MCP server 索引）读取列表，
 * 解析 README.md 中的条目，转换为 CCP 锚点格式。
 *
 * 采集策略：
 * - 获取 README.md 原始内容（raw.githubusercontent.com）
 * - 正则解析 Markdown 列表中的条目
 * - 对每个条目构造 CCP 锚点
 * - 支持增量更新（已存在的跳过）
 *
 * 版本：v1.0
 */

const AWESOME_MCP_RAW =
  "https://raw.githubusercontent.com/punkpeye/awesome-mcp-servers/main/README.md";
const CCP_SOURCE = "awesome-mcp-servers";

async function fetchREADME() {
  const resp = await fetch(AWESOME_MCP_RAW, {
    headers: { "User-Agent": "SkillMesh-CapCollector/1.0" },
  });
  if (!resp.ok) {
    throw new Error(`awesome-mcp-servers fetch failed: HTTP ${resp.status}`);
  }
  return resp.text();
}

function parseListEntries(markdown) {
  const entries = [];
  const lines = markdown.split("\n");

  let currentCategory = "";
  // 匹配列表项：- [Name](url) - description
  const itemPattern = /^-\s+\[([^\]]+)\]\(([^)]+)\)\s*[-–—]\s*(.+)$/;
  const headingPattern = /^##\s+(.+)/;

  for (const line of lines) {
    const headingMatch = line.match(headingPattern);
    if (headingMatch) {
      currentCategory = headingMatch[1].trim();
      continue;
    }

    const itemMatch = line.match(itemPattern);
    if (itemMatch) {
      const name = itemMatch[1].trim();
      const url = itemMatch[2].trim();
      const description = itemMatch[3].trim();

      const isGitHub = url.includes("github.com");
      const repoPath = isGitHub
        ? url.replace("https://github.com/", "").replace(/\/$/, "")
        : "";

      const capId = isGitHub
        ? `mcp-${repoPath.replace(/[/.]/g, "-").toLowerCase().slice(0, 60)}`
        : `mcp-${name
            .replace(/[^a-zA-Z0-9]/g, "-")
            .toLowerCase()
            .slice(0, 60)}`;

      entries.push({
        id: capId,
        name,
        name_en: name,
        desc: description,
        desc_en: description,
        input: "MCP protocol standard input (JSON-RPC 2.0)",
        input_en: "MCP protocol standard input (JSON-RPC 2.0)",
        output: "MCP protocol standard output",
        output_en: "MCP protocol standard output",
        endpoint: url,
        endpoint_type: "mcp",
        category: "data",
        provenance: url,
        features: [currentCategory || "mcp", "MCP Server"],
        features_en: [currentCategory || "mcp", "MCP Server"],
        trust_source: 0.5,
        source: CCP_SOURCE,
        raw: {
          category: currentCategory,
          is_github: isGitHub,
          repo: repoPath,
        },
      });
    }
  }

  return entries;
}

export async function fetchAwesomeMCPServers() {
  const markdown = await fetchREADME();
  return parseListEntries(markdown);
}

export function getSourceName() {
  return CCP_SOURCE;
}

export const SOURCE_NAME = CCP_SOURCE;
export const SOURCE_DISPLAY = "awesome-mcp-servers 社区列表";
