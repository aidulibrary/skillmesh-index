# CCP 实现列表

> 已知的 CCP 协议实现。提交你的实现请发 PR。

## 参考实现

### SkillMesh

| 属性     | 值                                             |
| -------- | ---------------------------------------------- |
| 类型     | 主节点 + 参考实现                              |
| 版本     | CCP v1.0.0                                     |
| 地址     | https://skillmesh.礼字号.中国                  |
| 仓库     | https://github.com/aidulibrary/skillmesh-index |
| 技术栈   | Cloudflare Pages + Workers + D1 + KV           |
| 协议支持 | 完整：发现、评估、调用、路由、遥测、联邦       |
| 维护者   | SkillMesh 社区                                 |

### CCP SDK（JavaScript）

| 属性     | 值                                                                           |
| -------- | ---------------------------------------------------------------------------- |
| 类型     | 客户端 SDK                                                                   |
| 版本     | v1.0.0                                                                       |
| 包名     | `@skillmesh/ccp-client`                                                      |
| 语言     | JavaScript / TypeScript                                                      |
| 仓库     | https://github.com/aidulibrary/skillmesh-index/tree/main/packages/ccp-client |
| 协议支持 | 完整客户端接口                                                               |

## 实现指南

### 最小实现要求

一个 CCP 兼容实现必须支持以下端点：

```
GET /api/ccp/v1/capabilities          → 能力锚点列表
GET /api/ccp/v1/capabilities/{id}     → 能力锚点详情
GET /api/ccp/v1/search?q={keyword}    → 搜索
```

### 完整实现要求

```
GET /api/ccp/v1/capabilities
GET /api/ccp/v1/capabilities/{id}
GET /api/ccp/v1/capabilities/{id}/adapters/{framework}
GET /api/ccp/v1/search?q={keyword}[&federated=true]
POST /api/ccp/v1/telemetry
GET /api/ccp/v1/federation
GET /api/ccp/v1/federation/nodes
POST /api/ccp/v1/federation/nodes
POST /api/ccp/v1/federation/exchange
```

### 提交你的实现

1. Fork 本仓库
2. 在下方表格添加你的实现
3. 提交 PR

| 实现名称       | 版本 | 类型 | 地址 | 维护者 |
| -------------- | ---- | ---- | ---- | ------ |
| （待社区提交） | —    | —    | —    | —      |
