# ccp-to-mcp

CCP → MCP 桥接工具：将 CCP 能力锚点转换为 MCP Server 配置。

## 安装

```bash
npm install -g ccp-to-mcp
```

## 用法

```bash
# 单个能力转换
ccp-to-mcp single pdf-extract-text-001

# 搜索并批量转换
ccp-to-mcp search "pdf text"

# 指定 CCP 端点
ccp-to-mcp search "contract" --endpoint https://my-ccp.example.com/api/ccp/v1

# 查看能力信息（含转换预览）
ccp-to-mcp info pdf-extract-text-001
```

## 输出格式

输出为标准 MCP `mcp.json` 格式，可直接用于 MCP 客户端。CCP 特有的信任向量和证据层以 `_ccp` metadata 形式保留。

```json
{
  "mcpServers": {
    "pdf-extract-text-001": {
      "url": "https://example.com/pdf",
      "type": "http",
      "description": "Extract all text from PDF",
      "_ccp": {
        "trust": {
          "source": 0.92,
          "success": 0.97
        },
        "evidence": {
          "count": 1200,
          "uncertainty": 0.1
        }
      }
    }
  }
}
```

## 许可

MIT
