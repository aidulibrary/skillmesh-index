/**
 * S18 能力采集引擎 — GitHub MCP 开源生态适配器
 * ==============================================
 *
 * 通过 GitHub Search API 搜索 topic:mcp-server 仓库，
 * 解析 README 摘要，转换为 CCP 锚点格式。
 *
 * 采集策略：
 * - 搜索 GitHub topic:mcp-server（按 stars 排序，取前 50）
 * - 对每个仓库提取描述、语言、星数、README 摘要
 * - 去重：已存在于 D1 的跳过
 * - 限速：每次最多 50 个仓库（免费 API 60 req/h 内安全）
 *
 * 版本：v1.0
 */

const GITHUB_API = "https://api.github.com";
const CCP_SOURCE = "github-mcp-ecosystem";

async function fetchJSON(url, headers = {}) {
  const resp = await fetch(url, {
    headers: {
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "SkillMesh-CapCollector/1.0",
      ...headers,
    },
  });
  if (!resp.ok) {
    throw new Error(`GitHub API ${resp.status}: ${resp.statusText}`);
  }
  return resp.json();
}

function normalizeCapId(repoFullName) {
  return `mcp-${repoFullName.replace(/[/_.]/g, "-").toLowerCase().slice(0, 60)}`;
}

function inferCategory(topics, language) {
  const tset = new Set((topics || []).map((t) => t.toLowerCase()));
  if (tset.has("database") || tset.has("sql")) return "data";
  if (tset.has("file") || tset.has("filesystem")) return "data";
  if (tset.has("browser") || tset.has("web")) return "web";
  if (tset.has("search") || tset.has("rag")) return "search";
  if (tset.has("devops") || tset.has("ci")) return "dev";
  if (tset.has("ai") || tset.has("llm") || tset.has("gpt")) return "ai";
  if (language === "Python") return "data";
  if (language === "TypeScript" || language === "JavaScript") return "dev";
  return "data";
}

function buildFeatures(topics, language) {
  const features = [
    ...new Set([...(topics || []).slice(0, 5), language].filter(Boolean)),
  ];
  return features.slice(0, 8);
}

export async function fetchGitHubMCPServers(token) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const limit = Math.min(50, token ? 50 : 30);

  const url = `${GITHUB_API}/search/repositories?q=topic:mcp-server+is:public&sort=stars&order=desc&per_page=${limit}`;
  const data = await fetchJSON(url, headers);

  if (!data.items || !Array.isArray(data.items)) {
    console.warn("[github-mcp] Unexpected response format:", Object.keys(data));
    return [];
  }

  return data.items.map((repo) => {
    const repoFullName = repo.full_name;
    const description = (repo.description || "").trim();
    const topics = repo.topics || [];
    const language = repo.language || "";
    const stars = repo.stargazers_count || 0;
    const capId = normalizeCapId(repoFullName);

    const trustSource = Math.min(0.9, 0.4 + stars / 5000);

    return {
      id: capId,
      name: repoFullName,
      name_en: repoFullName,
      desc: description || `MCP server: ${repoFullName}`,
      desc_en: description || `MCP server: ${repoFullName}`,
      input: "MCP protocol standard input (JSON-RPC 2.0)",
      input_en: "MCP protocol standard input (JSON-RPC 2.0)",
      output: "MCP protocol standard output (tools/resources/prompts)",
      output_en: "MCP protocol standard output (tools/resources/prompts)",
      endpoint: repo.clone_url || repo.html_url,
      endpoint_type: "mcp",
      category: inferCategory(topics, language),
      provenance: repo.html_url,
      features: buildFeatures(topics, language),
      features_en: buildFeatures(topics, language),
      trust_source: trustSource,
      source: CCP_SOURCE,
      raw: {
        stars,
        language,
        topics,
        updated_at: repo.updated_at,
        open_issues: repo.open_issues_count,
        license: repo.license?.spdx_id || "",
      },
    };
  });
}

export function getSourceName() {
  return CCP_SOURCE;
}

export const SOURCE_NAME = CCP_SOURCE;
export const SOURCE_DISPLAY = "GitHub MCP 开源生态";
