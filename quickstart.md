# CCP 协议 5 分钟快速开始

## 第一步：搜索能力（30 秒）
```bash
curl "https://skillmesh.礼字号.中国/api/ccp/v1/search?q=pdf"
```

## 第二步：获取能力详情（30 秒）
```bash
curl "https://skillmesh.礼字号.中国/api/ccp/v1/capabilities/pdf-extract-text-001"
```

## 第三步：生成框架适配器（1 分钟）
```bash
curl "https://skillmesh.礼字号.中国/api/ccp/v1/capabilities/pdf-extract-text-001/adapters/langchain"
curl "https://skillmesh.礼字号.中国/api/ccp/v1/capabilities/pdf-extract-text-001/adapters/mcp"
curl "https://skillmesh.礼字号.中国/api/ccp/v1/capabilities/pdf-extract-text-001/adapters/dsh"
```

## 第四步：注册你自己的能力（1 分钟）
```bash
curl -X POST "https://skillmesh.礼字号.中国/api/ccp/v1/contribute" \
  -H "Content-Type: application/json" \
  -d '{"id":"my-first-cap-001","name":"我的第一个能力","name_en":"My First Capability","desc":"这是我的第一个 CCP 能力锚点","desc_en":"My first CCP capability anchor","input":"输入文本","input_en":"Input text","output":"输出文本","output_en":"Output text","endpoint":"https://your-api.example.com/run","endpointType":"http","category":"ai","features":["fast","accurate"]}'
```

## 第五步：使用 SDK（1 分钟）

### JavaScript
```bash
npm install @skillmesh-ccp/ccp-client
```
```javascript
import { CCPClient } from "@skillmesh-ccp/ccp-client";
const client = new CCPClient();
const results = await client.search("pdf");
console.log(`找到 ${results.count} 个能力`);
```

### Python
```bash
pip install ccp-client
```
```python
from ccp_client import CCPClient
client = CCPClient()
results = client.search("pdf")
print(f"找到 {results.count} 个能力")
```

## 在线 Playground
- 搜索：https://skillmesh.礼字号.中国/api/ccp/v1/search?q=demo
- 能力列表：https://skillmesh.礼字号.中国/api/ccp/v1/capabilities
- 健康面板：https://skillmesh.礼字号.中国/health
- 联邦节点：https://skillmesh.礼字号.中国/api/ccp/v1/federation/nodes
