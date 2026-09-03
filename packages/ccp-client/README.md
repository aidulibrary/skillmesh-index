# @skillmesh-ccp/ccp-client

CCP（Capability Commensurability Protocol）v1.0.0 客户端 SDK。
封装 13 个 API 方法，简化 Agent / 应用接入能力通约协议。

## 安装

```bash
npm install @skillmesh-ccp/ccp-client
```

## 快速开始

```js
const { CCPClient } = require("@skillmesh-ccp/ccp-client");

const client = new CCPClient({
  baseUrl: "https://skillmesh.礼字号.中国/api/ccp/v1",
  agentId: "my-agent",
});

// 搜索能力锚点
const { count, results } = await client.search("pdf");

// 获取能力详情
const cap = await client.getCapability("pdf-extract-text-001");

// 联邦搜索
const fed = await client.search("blast", { federated: true });
```

## API 参考

### 构造函数

```js
new CCPClient(options);
```

| 参数      | 类型     | 默认值                                     | 说明              |
| --------- | -------- | ------------------------------------------ | ----------------- |
| `baseUrl` | `string` | `https://skillmesh.礼字号.中国/api/ccp/v1` | CCP API 根地址    |
| `timeout` | `number` | `15000`                                    | 请求超时（毫秒）  |
| `agentId` | `string` | `marvis`                                   | 调用方 Agent 标识 |

### 发现操作（Discover）

- **search(q, opts?)**: 搜索能力锚点，`opts.federated` 启用联邦搜索
- **getCapability(id)**: 获取能力锚点详情
- **listCapabilities()**: 列出全部能力锚点

### 评估操作（Evaluate）

- **getTrustVector(id)**: 获取能力信任向量（5 维度 + 证据层）

### 调用操作（Invoke）

- **getAdapter(id, framework)**: 生成指定框架适配器（DSH / MCP / LangChain / CrewAI / Dify）

### 路由操作（Route）

- **sendTelemetry(data)**: 回传遥测数据，驱动信任向量运行时更新
- **contribute(data)**: 提交社区贡献

### 联邦操作（Federation）

- **getNodeInfo()**: 获取本节点信息
- **listNodes()**: 列出联邦节点
- **addNode(data)**: 注册联邦节点
- **removeNode(id)**: 删除联邦节点
- **exchangeIndex(data)**: 与联邦节点交换索引摘要

### 监控

- **getMetrics()**: 获取节点监控指标

## 错误处理

所有方法在请求失败时抛出 `Error` 对象，附加属性：

| 属性       | 类型     | 说明                                    |
| ---------- | -------- | --------------------------------------- |
| `status`   | `number` | HTTP 状态码                             |
| `code`     | `string` | CCP 错误码（如 `CAPABILITY_NOT_FOUND`） |
| `response` | `object` | 完整响应体                              |

```js
try {
  await client.getCapability("nonexistent");
} catch (err) {
  console.log(err.code); // "CAPABILITY_NOT_FOUND"
  console.log(err.status); // 404
}
```

## 信任向量

```js
const { vector } = await client.getTrustVector("pdf-extract-text-001");
// {
//   source: 92,    // 源码可验证性
//   usage: 20,     // 使用量
//   usageRate: 78, // 使用成交率
//   success: 97,   // 成功率
//   risk: 90,      // 依赖风险（反向：越高越安全）
//   time: 88,      // 时效性
//   evidence: 100  // 证据充分度
// }
```

## 协议

CCP v1.0.0 · [协议规范](https://github.com/aidulibrary/ccp-spec)

## 许可

MIT
