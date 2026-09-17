/**
 * 适配器生成器
 * =============
 * CCP 协议路由层适配器生成模块。
 *
 * 支持框架：
 * - DSH (DeepSeek-Harness) → plugin.yaml
 * - MCP (Model Context Protocol) → mcp.json
 * - LangChain → Tool 定义 JSON
 * - CrewAI → Tool Schema
 * - Dify → 工具配置 YAML
 *
 * 版本：v1.0
 * 协议：CCP v1.0.0
 */

const HOMEPAGE = "https://skillmesh.礼字号.中国";
const CCP_VERSION = "v1.0.0";

function generateDSHAdapter(cap) {
  const name = cap.name;
  const nameEn = cap.name_en;
  const features = cap.features || [];
  const endpoint = cap.endpoint;
  const epType = cap.endpointType;
  const repo = cap.provenance || "";
  const category = cap.category;
  const now = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");

  const runtimeType =
    epType === "mcp" ? "mcp-server" : epType === "http" ? "http" : "function";

  const caps = features
    .map(
      (f) =>
        `  - name: ${f.toLowerCase().replace(/\s+/g, "-")}\n    description: "${f}"`,
    )
    .join("\n");

  const capabilitiesSection = caps ? `\ncapabilities:\n${caps}` : "";
  const riskScore = ((1 - cap.trustSource) * 5 + cap.trustRisk * 5).toFixed(1);

  return `# ============================================================
# 由 SkillMesh / CCP 路由操作自动生成
# 源能力锚点：${cap.id}
# 生成时间：${now}
# CCP 协议版本：${CCP_VERSION}
# ============================================================

apiVersion: deepseek.io/plugin/v1
kind: Plugin
metadata:
  name: ${cap.id.replace(/_/g, "-")}
  version: 1.0.0
  description: "${name} — ${nameEn}"
  authors:
    - name: "CCP Community"
  license: MIT
  homepage: "${HOMEPAGE}"
  repository: "${repo}"
  tags: [${cap.id.split("-").slice(0, -1).join(", ")}]
  categories: [${category}]
  maturity: stable
  minHarnessVersion: "0.8.0"

runtime:
  type: ${runtimeType}
  entrypoint:
    command: ["python", "-m", "${cap.id.replace(/-/g, "_").replace(/_\d+$/, "")}"]
  env:
    - name: ENDPOINT_URL
      description: "Service endpoint"
      required: true
      default: "${endpoint}"${capabilitiesSection}

permissions:
  services:
    inject: [fs]
    provide: [${cap.id.replace(/-/g, "-")}]
  sandbox:
    recommended: workspace-read
  riskScore: ${riskScore}

# CCP 信任向量（以注释形式保留，供 DSH 安全策略参考）
# trustSource: ${cap.trustSource.toFixed(2)}
# trustUsage: ${cap.trustUsage}
# trustSuccess: ${cap.trustSuccess.toFixed(2)}
# trustRisk: ${cap.trustRisk.toFixed(2)}
# trustTime: ${cap.trustTime.toFixed(2)}
# evidence: { count: ${cap.evidence ? cap.evidence.count : 0}, uncertainty: ${cap.evidence ? cap.evidence.uncertainty.toFixed(2) : 0.1} }`;
}

function generateMCPAdapter(cap) {
  const tools = (cap.features || []).map((f) => ({
    name: f.toLowerCase().replace(/\s+/g, "-"),
    description: f,
  }));
  tools.push({
    name: cap.id.replace(/-/g, "_"),
    description: cap.desc,
    inputSchema: {
      type: "object",
      properties: {
        input: { type: "string", description: cap.input },
      },
      required: ["input"],
    },
  });
  return JSON.stringify(
    {
      mcpServers: {
        [cap.id]: {
          type: cap.endpointType === "mcp" ? "stdio" : "http",
          url: cap.endpoint,
          description: cap.desc,
          tools,
          trust: {
            source: cap.trustSource,
            success: cap.trustSuccess,
            evidence: cap.evidence ? cap.evidence.count : 0,
          },
        },
      },
    },
    null,
    2,
  );
}

function generateLangChainAdapter(cap) {
  return JSON.stringify(
    {
      type: "function",
      function: {
        name: cap.id.replace(/-/g, "_"),
        description: cap.desc,
        parameters: {
          type: "object",
          properties: {
            input: { type: "string", description: cap.input },
          },
          required: ["input"],
        },
        _examples: [
          {
            input: cap.input,
            description: "示例调用：传入能力输入（URL 或本地路径）",
          },
        ],
      },
      endpoint: cap.endpoint,
      endpointType: cap.endpointType,
      _ccp_trust: {
        source: cap.trustSource,
        success: cap.trustSuccess,
        evidence: cap.evidence ? cap.evidence.count : 0,
      },
    },
    null,
    2,
  );
}

function generateCrewAIAdapter(cap) {
  return JSON.stringify(
    {
      name: cap.id.replace(/-/g, "_"),
      description: cap.desc,
      expected_output: cap.output,
      endpoint: cap.endpoint,
      endpoint_type: cap.endpointType,
      trust_metadata: {
        source_verified: cap.trustSource,
        success_rate: cap.trustSuccess,
        evidence_count: cap.evidence ? cap.evidence.count : 0,
      },
    },
    null,
    2,
  );
}

function generateDifyAdapter(cap) {
  return [
    "# Dify 自定义工具配置",
    "# 由 SkillMesh / CCP 路由操作自动生成",
    `# 源能力锚点：${cap.id}`,
    "",
    `name: ${cap.id}`,
    `description: ${cap.desc}`,
    `endpoint: ${cap.endpoint}`,
    "method: POST",
    "headers:",
    "  Content-Type: application/json",
    "parameters:",
    "  - name: input",
    "    type: string",
    `    description: ${cap.input}`,
    "    required: true",
    "# CCP 信任参考",
    `# trust_source: ${cap.trustSource.toFixed(2)}`,
    `# trust_success: ${cap.trustSuccess.toFixed(2)}`,
    `# evidence_count: ${cap.evidence ? cap.evidence.count : 0}`,
  ].join("\n");
}

/**
 * 生成适配器
 *
 * @param {object} cap - 能力锚点对象
 * @param {string} framework - 目标框架（dsh|mcp|langchain|crewai|dify）
 * @returns {{ type: string, content: string }|null}
 */
export function generateAdapter(cap, framework) {
  switch (framework) {
    case "dsh":
      return { type: "yaml", content: generateDSHAdapter(cap) };
    case "mcp":
      return { type: "json", content: generateMCPAdapter(cap) };
    case "langchain":
      return { type: "json", content: generateLangChainAdapter(cap) };
    case "crewai":
      return { type: "json", content: generateCrewAIAdapter(cap) };
    case "dify":
      return { type: "yaml", content: generateDifyAdapter(cap) };
    default:
      return null;
  }
}

export default { generateAdapter };
