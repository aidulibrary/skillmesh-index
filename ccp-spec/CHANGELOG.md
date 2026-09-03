# CCP 协议变更日志

## [v1.0.0] — 2026-09-02

### 正式冻结

- Schema 承诺向后兼容：新增字段为 optional，已有字段不删除不修改类型
- 协议版本号从 v0.x 升级至 v1.0.0

### 新增

- **路由操作（Route）**：CCP 第四操作，包含代码生成、浏览器试用、Agent 适配器、一键复制、能力编排五种模式
- **联邦化协议**：基于 ActivityPub 简化模型，支持节点注册、索引摘要交换、联邦搜索
- **结构化错误码**：统一 API 错误响应格式，包含 code、message、message_en、detail 字段
- **遥测闭环**：信任向量运行时自动更新，证据层动态演化
- **适配器生成 API**：支持 DSH、MCP、LangChain、CrewAI、Dify 五种框架

### 变更

- 信任向量权重从草案值调整为 DCI 论文 AHP 实证值：source:0.25 / usage:0.15 / success:0.30 / risk:0.15 / time:0.15
- 证据层公式优化：`u ≈ 1 / (1 + log10(count))`
- 能力锚点 Schema 新增 `status` 字段（active/deprecated/experimental）

### 移除

- 无

---

## [v0.3.0] — 2026-08-30

### 新增

- 遥测端点（POST /api/ccp/v1/telemetry）：信任向量运行时闭环
- 社区贡献 API：POST /api/ccp/v1/contribute
- CI Schema 自动校验
- PR 模板

### 变更

- 数据存储从静态 JSON 迁移至 D1 数据库
- FTS5 全文搜索性能优化

---

## [v0.2.0] — 2026-08-29

### 新增

- 能力锚点 D1 数据库迁移
- FTS5 全文搜索
- JSON Schema 校验
- 社区贡献指南

### 变更

- 搜索端点从简单匹配升级为 FTS5 全文搜索

---

## [v0.1.0] — 2026-08-28

### 初始草案

- 能力锚点 Schema（必填字段、信任向量字段、可选字段）
- 三大操作：发现（Discover）、评估（Evaluate）、调用（Invoke）
- 通约层与分发层分离原则
- 数据格式与存储策略
- 协议演进与版本策略
