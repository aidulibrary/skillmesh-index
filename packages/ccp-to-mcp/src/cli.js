#!/usr/bin/env node
/**
 * ccp-to-mcp CLI
 * ==============
 * CCP → MCP 桥接工具。
 *
 * 功能：
 * - 将单个 CCP 能力锚点转换为 MCP Server 配置
 * - 从 CCP API 批量搜索并生成 MCP 配置
 * - 输出 mcp.json（标准 MCP 配置文件格式）
 *
 * 用法：
 *   ccp-to-mcp single <anchor-id>              # 单个能力转换
 *   ccp-to-mcp search <query>                  # 搜索并批量转换
 *   ccp-to-mcp search <query> --endpoint <url>  # 指定 CCP 端点
 *
 * 版本：v1.0.0
 * 协议：CCP v1.0.0
 */

const CCP_DEFAULT_ENDPOINT = "https://skillmesh.礼字号.中国/api/ccp/v1";

class CCPClient {
  constructor(endpoint) {
    this.endpoint = endpoint.replace(/\/$/, "");
  }

  async _request(path) {
    const url = `${this.endpoint}${path}`;
    const resp = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "ccp-to-mcp/1.0.0",
      },
    });
    if (!resp.ok) {
      throw new Error(`CCP API error: ${resp.status} ${resp.statusText}`);
    }
    return resp.json();
  }

  async search(q) {
    const data = await this._request(`/search?q=${encodeURIComponent(q)}`);
    return data.results || [];
  }

  async detail(id) {
    return this._request(`/capabilities/${encodeURIComponent(id)}`);
  }
}

/**
 * 将 CCP 能力锚点转换为 MCP Server 配置
 *
 * CCP 的能力锚点语义比 MCP 的工具语义更丰富：
 * - CCP 有信任向量（五维）→ MCP 以 metadata 形式保留
 * - CCP 有证据层（调用次数/不确定性）→ MCP 以 metadata 形式保留
 * - CCP 有 category/features/tags → MCP 以 metadata 形式保留
 */
function ccpToMcpServer(cap) {
  const serverConfig = {
    mcpServers: {
      [cap.id]: {
        command: cap.endpointType === "mcp" ? "npx" : null,
        args: cap.endpointType === "mcp" ? ["-y", cap.endpoint] : null,
        url: cap.endpointType === "http" ? cap.endpoint : null,
        type: cap.endpointType === "mcp" ? "stdio" : "http",
        env: {},
        description: cap.desc_en || cap.desc,
        _ccp: {
          protocol: "CCP",
          version: "v1.0.0",
          capability_id: cap.id,
          name: cap.name,
          name_en: cap.name_en,
          category: cap.category,
          input: cap.input,
          output: cap.output,
          trust: {
            source: cap.trustSource,
            usage: cap.trustUsage,
            usage_rate: cap.trustUsageRate,
            success: cap.trustSuccess,
            risk: cap.trustRisk,
            time: cap.trustTime,
          },
          evidence: {
            count: cap.evidence?.count || 0,
            uncertainty: cap.evidence?.uncertainty || 0.5,
          },
          features: cap.features || [],
          tags: cap.tags || [],
        },
      },
    },
  };

  return serverConfig;
}

/**
 * 合并多个 MCP Server 配置
 */
function mergeMcpConfigs(configs) {
  const merged = { mcpServers: {} };
  for (const config of configs) {
    Object.assign(merged.mcpServers, config.mcpServers);
  }
  return merged;
}

function printHelp() {
  console.log(`
ccp-to-mcp — CCP → MCP 桥接工具

用法:
  ccp-to-mcp single <capability-id>              单个能力转换
  ccp-to-mcp search <query>                      搜索并批量转换
  ccp-to-mcp search <query> --endpoint <url>     指定 CCP 端点
  ccp-to-mcp info <capability-id>                查看能力信息（转换预览）

选项:
  --endpoint <url>   CCP API 端点（默认: ${CCP_DEFAULT_ENDPOINT}）
  --compact          紧凑输出（不格式化）
  --help             显示帮助

示例:
  ccp-to-mcp single pdf-extract-text-001
  ccp-to-mcp search "pdf text"
  ccp-to-mcp search "contract review" --endpoint https://my-ccp.example.com/api/ccp/v1
  ccp-to-mcp info pdf-extract-text-001
`);
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes("--help")) {
    printHelp();
    process.exit(0);
  }

  const command = args[0];
  const target = args[1];

  if (!target) {
    console.error("错误: 缺少参数");
    printHelp();
    process.exit(1);
  }

  const endpointIdx = args.indexOf("--endpoint");
  const endpoint =
    endpointIdx !== -1 ? args[endpointIdx + 1] : CCP_DEFAULT_ENDPOINT;
  const compact = args.includes("--compact");

  const client = new CCPClient(endpoint);

  try {
    switch (command) {
      case "single": {
        const cap = await client.detail(target);
        const config = ccpToMcpServer(cap);
        console.log(JSON.stringify(config, null, compact ? 0 : 2));
        break;
      }

      case "search": {
        const results = await client.search(target);
        if (results.length === 0) {
          console.log("// 未找到匹配的能力锚点");
          console.log(JSON.stringify({ mcpServers: {} }, null, 2));
          process.exit(0);
        }

        const configs = [];
        for (const r of results) {
          try {
            const cap = await client.detail(r.id);
            configs.push(ccpToMcpServer(cap));
          } catch (e) {
            console.error(`// 警告: 获取 ${r.id} 详情失败: ${e.message}`);
          }
        }

        const merged = mergeMcpConfigs(configs);
        console.log(JSON.stringify(merged, null, compact ? 0 : 2));
        console.error(
          `// 已转换 ${configs.length}/${results.length} 个能力锚点`,
        );
        break;
      }

      case "info": {
        const cap = await client.detail(target);
        console.log(`能力锚点: ${cap.id}`);
        console.log(`名称:     ${cap.name} (${cap.name_en})`);
        console.log(`分类:     ${cap.category}`);
        console.log(`端点:     ${cap.endpoint} (${cap.endpointType})`);
        console.log(`输入:     ${cap.input}`);
        console.log(`输出:     ${cap.output}`);
        console.log(`信任向量:`);
        console.log(`  source:  ${cap.trustSource?.toFixed(2)}`);
        console.log(
          `  usage:   ${cap.trustUsage} (rate: ${cap.trustUsageRate?.toFixed(2)})`,
        );
        console.log(`  success: ${cap.trustSuccess?.toFixed(2)}`);
        console.log(`  risk:    ${cap.trustRisk?.toFixed(2)}`);
        console.log(`  time:    ${cap.trustTime?.toFixed(2)}`);
        if (cap.evidence) {
          console.log(
            `证据层:   count=${cap.evidence.count}, uncertainty=${cap.evidence.uncertainty?.toFixed(2)}`,
          );
        }
        console.log(`\nMCP 转换预览:`);
        const preview = ccpToMcpServer(cap);
        console.log(JSON.stringify(preview, null, 2));
        break;
      }

      default:
        console.error(`错误: 未知命令 "${command}"`);
        printHelp();
        process.exit(1);
    }
  } catch (err) {
    console.error(`错误: ${err.message}`);
    process.exit(1);
  }
}

main();
