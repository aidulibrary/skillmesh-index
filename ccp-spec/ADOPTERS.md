# CCP 采纳者

> 已接入 CCP 协议的 Agent 框架和工具。

## 已接入框架

| 框架                 | 接入方式              | 适配器                  | 状态   |
| -------------------- | --------------------- | ----------------------- | ------ |
| **DeepSeek-Harness** | 适配器生成 + 路由操作 | `dsh.bundle.patch` YAML | 已支持 |
| **MCP 客户端**       | 适配器生成            | `mcp.json`              | 已支持 |
| **LangChain**        | 适配器生成            | Tool 定义 JSON          | 已支持 |
| **CrewAI**           | 适配器生成            | Tool Schema             | 已支持 |
| **Dify**             | 适配器生成            | 工具配置 YAML           | 已支持 |

## 接入方式

### 方式 1：通过适配器 API

```
GET /api/ccp/v1/capabilities/{id}/adapters/{framework}
```

返回指定框架的适配器配置，直接导入即可使用。

### 方式 2：通过 CCP SDK

```javascript
import { CCPClient } from "@skillmesh/ccp-client";

const client = new CCPClient({
  baseUrl: "https://skillmesh.礼字号.中国/api/ccp/v1",
});
const results = await client.search("PDF text extraction");
```

### 方式 3：直接 HTTP 调用

```bash
curl "https://skillmesh.礼字号.中国/api/ccp/v1/search?q=PDF+text"
```

## 提交你的采纳

1. Fork 本仓库
2. 在表格中添加你的框架/工具
3. 提交 PR

| 框架/工具      | 接入方式 | 适配器格式 | 状态 |
| -------------- | -------- | ---------- | ---- |
| （待社区提交） | —        | —          | —    |
