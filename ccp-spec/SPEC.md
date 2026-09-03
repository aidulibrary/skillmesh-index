# CCP v1.0.0 — 能力通约协议规范

> **协议全称**：Capability Commensurability Protocol（能力通约协议）
> **版本**：v1.0.0（正式冻结）
> **日期**：2026-09-02
> **状态**：已实现（SkillMesh 参考实现已部署）
> **协议标识**：CCP
> **许可**：CC BY-SA 4.0

---

## 零、导言：为什么需要 CCP

当前 AI 能力生态面临三重名实乖离：

1. **"插件"之名遮蔽了"能力通约"之实**：以"可安装的代码包"定义插件，混淆了分发形态与能力本质。
2. **"工具声明"之名遮蔽了"认知能力"之实**：Agent 需要的不是"调用 parse_pdf"这个操作，而是"理解 PDF 内容"这个认知结果。
3. **"发布者身份"之名遮蔽了"能力可信度"之实**：调用方不关心能力来自谁，只关心能力是否可靠、是否可用。

CCP 协议将这三重误认消解，将"插件"重构为"能力锚点"——一个使异构系统间能力请求与能力执行得以对接的最小通约协议。

**核心原则**：协议优先于平台。CCP 本身是公共基础设施，不绑定任何特定实现、平台或分发渠道。

---

## 一、能力锚点（Capability Anchor）Schema

能力锚点是 CCP 协议的基本操作单元。它不包含代码、不包含安装脚本、不包含运行时环境——只包含让调用方能够**发现、评估、调用**该能力所需的最小元数据集。

### 1.1 必填字段

| 字段           | 类型           | 说明                                | 示例                                                         |
| -------------- | -------------- | ----------------------------------- | ------------------------------------------------------------ |
| `id`           | `string`       | 全局唯一标识符，格式 `{name}-{seq}` | `"pdf-extract-text-001"`                                     |
| `name`         | `string`       | 中文能力名称                        | `"PDF文本提取"`                                              |
| `name_en`      | `string`       | 英文能力名称                        | `"PDF Text Extraction"`                                      |
| `desc`         | `string`       | 中文能力描述（自然语言）            | `"从PDF文件中提取全部文本内容，保留段落结构"`                |
| `desc_en`      | `string`       | 英文能力描述                        | `"Extract all text from PDF files..."`                       |
| `input`        | `string`       | 中文输入参数说明                    | `"PDF文件URL或本地路径"`                                     |
| `input_en`     | `string`       | 英文输入参数说明                    | `"PDF file URL or local path"`                               |
| `output`       | `string`       | 中文输出承诺说明                    | `"结构化文本字符串，包含页码映射"`                           |
| `output_en`    | `string`       | 英文输出承诺说明                    | `"Structured text string with page mapping"`                 |
| `endpoint`     | `string`       | 调用端点 URI                        | `"mcp://pymupdf-server/extract-text"`                        |
| `endpointType` | `enum`         | 调用方式类型                        | `"http"` / `"mcp"` / `"command"` / `"prompt"` / `"workflow"` |
| `category`     | `enum`         | 能力分类                            | `"ai"` / `"data"` / `"media"` / `"language"` / `"dev"`       |
| `provenance`   | `string` (URL) | 源码/项目来源链接                   | `"https://github.com/pymupdf/PyMuPDF"`                       |

### 1.2 信任向量字段（L1）

信任向量是 CCP 区别于传统"星级评分"的核心创新。它采用多维向量替代单一分数，允许调用方根据自身需求对不同维度赋予不同权重。

| 字段             | 类型                | 说明                                       | 范围           |
| ---------------- | ------------------- | ------------------------------------------ | -------------- |
| `trustSource`    | `float`             | 源码可验证性：声明是否可追溯到源码         | 0-1            |
| `trustUsage`     | `integer`           | 使用痕迹：原始调用次数                     | >=0            |
| `trustUsageRate` | `float`             | 使用痕迹归一化评分                         | 0-1            |
| `trustSuccess`   | `float`             | 成功率：历史调用成功率                     | 0-1            |
| `trustRisk`      | `float`             | 依赖风险：依赖链复杂度与健康度（越低越好） | 0-1            |
| `trustTime`      | `float`             | 时效性：能力数据的时效性（越高越新）       | 0-1            |
| `lastUpdated`    | `string` (ISO date) | 最后验证/更新日期                          | `"2026-08-20"` |

### 1.3 证据层字段（L2）

基于 Josang 主观逻辑理论，单一信任分数混淆"基于 3 次调用的 100% 成功率"与"基于 1 万次调用的 97% 成功率"。L2 证据层显式建模证据量 n 与不确定性 u。

| 字段                   | 类型      | 说明                        | 范围 |
| ---------------------- | --------- | --------------------------- | ---- |
| `evidence.count`       | `integer` | 证据量 n：累计调用/验证次数 | >=0  |
| `evidence.uncertainty` | `float`   | 不确定性 u：n 越大 u 越小   | 0-1  |

**不确定性计算参考公式**：`u ≈ 1 / (1 + log10(count))`

### 1.4 可选字段

| 字段            | 类型       | 说明                                           |
| --------------- | ---------- | ---------------------------------------------- |
| `features`      | `string[]` | 中文功能特性列表                               |
| `features_en`   | `string[]` | 英文功能特性列表                               |
| `usageGuide`    | `string`   | 中文使用说明                                   |
| `usageGuide_en` | `string`   | 英文使用说明                                   |
| `codeExample`   | `string`   | 调用代码示例（JSON 格式）                      |
| `tags`          | `string[]` | 语义标签（用于分类和检索）                     |
| `dependencies`  | `string[]` | 依赖的其他能力锚点 ID                          |
| `version`       | `string`   | 能力版本号（SemVer）                           |
| `status`        | `enum`     | `"active"` / `"deprecated"` / `"experimental"` |

---

## 二、CCP 三大操作

### 2.1 发现（Discover）

调用方通过自然语言描述或结构化查询，检索匹配的能力锚点。

**检索模式**：

- **关键词匹配**：对 `name`、`desc`、`id`、`category`、`endpointType` 字段执行大小写不敏感的模糊匹配。
- **语义检索**：对 `name`、`desc` 字段生成文本嵌入向量，计算查询向量与锚点向量的余弦相似度。
- **分类过滤**：按 `category` 字段精确筛选。

**排序规则**：

- 默认按综合信任分降序排列。
- 综合信任分 = 五维信任向量加权求和 × (1 - 不确定性惩罚因子)。

**综合信任分计算**：

```
信任权重分配（基于 DCI 论文 AHP 实证）：
  source: 0.25（源码可验证性）
  usage:  0.15（使用痕迹）
  success: 0.30（成功率，最高权重）
  risk:   0.15（依赖风险，1-riskScore）
  time:   0.15（时效性）

综合信任分 = (w_source × trustSource + w_usage × usageRate + w_success × trustSuccess + w_risk × (1-trustRisk) + w_time × timeScore) × (1 - uncertainty × 0.5)
```

### 2.2 评估（Evaluate）

调用方获取能力锚点的完整信任向量和证据层数据，进行自主风险评估。

**评估维度**：

- 五维信任向量（L1）：直观展示各维度信任水平。
- 证据层（L2）：展示证据量和不确定性，区分"高置信度"与"低置信度"的高分。
- 新能力标记：`evidence.count < 100` 的能力标注"新能力"徽标，提醒调用方证据不足。

### 2.3 调用（Invoke）

调用方通过 `endpoint` 字段获取调用端点，通过 `endpointType` 判断调用方式，按 `input` 字段构造请求，按 `output` 字段解析响应。

**调用方式类型**：

| 类型       | 说明          | 端点格式                         |
| ---------- | ------------- | -------------------------------- |
| `http`     | HTTP REST API | `https://api.example.com/v1/...` |
| `mcp`      | MCP 协议      | `mcp://server-name/method`       |
| `command`  | 命令行工具    | `command://tool-name --arg`      |
| `prompt`   | 提示词协议    | `prompt://action?param={value}`  |
| `workflow` | 工作流编排    | `workflow://pipeline/name`       |

---

## 三、CCP 第四操作：路由（Route）

> **新增于 v1.0.0**

### 3.0 为什么需要"路由"操作

CCP 协议的边界原则是"通约层不执行代码"。但这带来了一个体验断层：用户从"发现"到"评估"到"调用"，在"调用"这一步被踢出 SkillMesh，需要自己翻文档、拼参数、写代码。**"路由"操作填补这个断层**——它不执行能力，而是帮用户**生成通往执行层的路径**。

### 3.1 路由操作的职责边界

| 路由层做什么                                   | 路由层不做什么           |
| ---------------------------------------------- | ------------------------ |
| 根据 `endpointType` 生成对应调用代码片段       | 托管代码或执行调用       |
| 为 HTTP 类型能力提供浏览器端 API 试用          | 管理运行时依赖或沙箱环境 |
| 生成 Agent 框架适配器配置（MCP/DSH/LangChain） | 安装 npm/pip 包          |
| 构造带认证信息的请求模板                       | 存储或代理 API 密钥      |
| 将多个能力锚点串联为调用工作流草稿             | 执行工作流或管理状态     |

### 3.2 路由操作的五种模式

#### 模式 1：代码生成（Code Generation）

根据 `endpointType` 和 `input`/`output` 字段，自动生成可执行的调用代码。

| endpointType | 生成内容                                    | 示例                                                                       |
| ------------ | ------------------------------------------- | -------------------------------------------------------------------------- |
| `http`       | cURL / fetch / Python requests / 各语言 SDK | `curl -X POST {endpoint} -H 'Content-Type: application/json' -d '{input}'` |
| `mcp`        | MCP 客户端配置 JSON                         | `{ "mcpServers": { "pdf-extract": { "url": "..." } } }`                    |
| `command`    | 终端命令 + 参数说明                         | `tool-name --arg1 value1 --arg2 value2`                                    |
| `prompt`     | 提示词模板                                  | 基于 `input` 字段填充的完整 Prompt                                         |
| `workflow`   | 工作流 DSL 草稿                             | YAML/JSON 格式的编排描述                                                   |

#### 模式 2：浏览器端试用（Browser Try-It）

仅对 `endpointType === "http"` 的能力锚点开放。用户在 SkillMesh 页面内直接发起 HTTP 请求，查看返回结果。

**约束条件**：

- 仅支持 GET/POST 方法，且目标 API 必须支持 CORS（或通过 Cloudflare Worker 代理）
- 每次试用自动递增 `evidence.count`（前端本地计数，非权威）
- 试用结果不持久化存储，刷新即丢失
- 敏感参数（API Key 等）由用户手动填入，SkillMesh 不存储

#### 模式 3：Agent 适配器配置（Agent Adapter）

为不同 Agent 框架生成能力锚点的接入配置。

| 框架                 | 适配器格式              | 说明                                |
| -------------------- | ----------------------- | ----------------------------------- |
| **DeepSeek-Harness** | `dsh.bundle.patch` YAML | 将能力锚点转为 DSH 可安装的插件声明 |
| **MCP 客户端**       | `mcp.json`              | 标准 MCP 服务器配置                 |
| **LangChain**        | Tool 定义 JSON          | 将能力锚点映射为 LangChain Tool     |
| **CrewAI**           | Tool Schema             | 将能力锚点映射为 CrewAI Tool        |
| **Dify**             | 工具配置 YAML           | 将能力锚点映射为 Dify 自定义工具    |

#### 模式 4：一键复制（Copy-to-Clipboard）

将端点 URL、参数模板、认证方式组合为一行可复制的命令或代码片段，用户粘贴到自己的终端/IDE 中执行。

#### 模式 5：能力组合编排（Capability Orchestration）

将多个能力锚点按工作流逻辑串联，生成调用序列草稿：

```
A 的输出 → 转换 → B 的输入 → C 的输入
```

输出为 CCP 工作流描述 JSON，供外部编排引擎（如 Dify、Temporal）消费。

### 3.3 路由操作的数据流

```
┌─────────────────────────────────────────────────────┐
│                    CCP 通约层                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │
│  │ 发现     │  │ 评估     │  │ 调用（协议定义）  │  │
│  │ Discover │  │ Evaluate │  │ Invoke (Schema)  │  │
│  └──────────┘  └──────────┘  └────────┬─────────┘  │
│                                       │             │
│                          ┌────────────▼──────────┐  │
│                          │ 路由（新增）           │  │
│                          │ Route                  │  │
│                          │ ┌───────────────────┐  │  │
│                          │ │ 代码生成           │  │  │
│                          │ │ 浏览器试用         │  │  │
│                          │ │ Agent 适配器       │  │  │
│                          │ │ 一键复制           │  │  │
│                          │ │ 能力组合编排       │  │  │
│                          │ └───────────────────┘  │  │
│                          └────────────┬──────────┘  │
└───────────────────────────────────────┼─────────────┘
                                        │
                         ┌──────────────▼──────────────┐
                         │        执行层（外部）        │
                         │  ┌────────┐  ┌───────────┐  │
                         │  │ 浏览器 │  │ Agent     │  │
                         │  │ fetch  │  │ 框架      │  │
                         │  └────────┘  └───────────┘  │
                         │  ┌────────┐  ┌───────────┐  │
                         │  │ 终端   │  │ 工作流    │  │
                         │  │ CLI    │  │ 引擎      │  │
                         │  └────────┘  └───────────┘  │
                         └─────────────────────────────┘
```

---

## 四、通约层与分发层分离原则

CCP 协议严格区分三个层次：

### 4.1 通约层（CCP 职责范围）

- 定义能力锚点的元数据 Schema。
- 定义能力锚点的发现、评估、调用协议。
- 定义信任向量的计算方法和证据层标准。
- 维护能力锚点索引（不包含代码）。

### 4.2 路由层（CCP 路由职责范围）

- 生成调用代码片段（cURL、fetch、Python、MCP 配置等）。
- 提供浏览器端 API 试用（HTTP 类型能力）。
- 生成 Agent 框架适配器配置（DSH、MCP、LangChain、CrewAI、Dify）。
- 提供一键复制调用指令。
- 生成能力组合编排草稿。

### 4.3 分发层（不在 CCP 职责范围）

- 代码托管与分发（npm、PyPI、GitHub Releases）。
- 运行时环境管理（Docker、沙箱、Serverless）。
- 安装与配置管理。
- 计费与授权。

**分离理由**：通约层关注"能力是什么、如何调用、是否可信"，分发层关注"代码在哪里、如何安装、如何运行"。将两者分离，使得：

- 同一个能力锚点可以对应多个分发实现。
- 分发层的变更不影响通约层的索引。
- 通约层可以索引任何形式的能力，不限于"可安装的软件包"。

---

## 五、数据格式与存储

### 5.1 数据格式

能力锚点数据以 JSON 数组形式存储，每个元素为符合上述 Schema 的 JSON 对象。

### 5.2 存储策略

- **关系型存储**：SQLite / D1，支持 FTS5 全文搜索、事务写入、联合查询。
- **静态降级**：静态 JSON 文件作为 API 不可用时的离线兜底数据源。
- **联邦化**：支持多 CCP 节点互相发现和交换能力锚点索引摘要（见第八章）。

---

## 六、协议演进

### 6.1 版本策略

- **v0.1**（2026-08-28）：草案阶段，Schema 字段可调整。
- **v1.0.0**（2026-09-02）：正式冻结，Schema 承诺向后兼容。新增字段为 optional，已有字段不删除不修改类型。

### 6.2 贡献方式

- 能力锚点提交：通过 GitHub Issue 模板或 Pull Request 提交。
- 协议修改：通过 GitHub Discussion 发起提案，经社区讨论后由维护者合入。

### 6.3 名实学治理原则

CCP 协议的演进遵循名实学三大定律：

1. **定律五（名实共振律）**：协议 Schema 的变更必须与社区实际需求保持共振，避免超前设计。
2. **定律十四（名实反馈律）**：通过正反馈（高质量能力上浮）和负反馈（低质量能力下沉）实现生态自组织。
3. **定律十五（名实终极律）**：协议趋向动态谐振的吸引子，不追求完全同一，也不容忍彻底分离。

---

## 七、遥测与信任向量闭环

### 7.1 设计原理

CCP 协议区别于传统"星级评分"的本质在于：信任向量不是静态属性，而是随 Agent 实际调用数据动态演化的**运行时闭环**。

### 7.2 遥测端点

```
POST /api/ccp/v1/telemetry
```

**请求体**：

| 字段            | 类型    | 必填 | 说明                         |
| --------------- | ------- | ---- | ---------------------------- |
| `capability_id` | string  | 是   | 被调用的能力锚点 ID          |
| `agent_id`      | string  | 是   | 调用方 Agent 标识            |
| `success`       | boolean | 是   | 调用是否成功                 |
| `latency_ms`    | integer | 否   | 调用耗时（毫秒）             |
| `error`         | string  | 否   | 错误信息（success=false 时） |

**响应**：`{ "received": true, "capability_id": "...", "trust_updated": true }`

### 7.3 信任向量更新算法

```javascript
// 伪代码：每次遥测回传后自动更新
new_trustUsage = old_trustUsage + 1;
new_evidence_count = old_evidence_count + 1;
new_trustSuccess =
  (old_trustSuccess * old_evidence_count + (success ? 1 : 0)) /
  new_evidence_count;
new_uncertainty = 1 / (1 + log10(new_evidence_count + 1));
new_trustUsageRate = min(1, log10(max(new_trustUsage, 1)) / 5);
```

### 7.4 限流策略

- 每 IP 每能力每秒最多 1 次遥测请求
- 超限返回 429 Too Many Requests
- 内存缓冲：60 秒或 100 条批量写入数据库

---

## 八、联邦化协议

### 8.1 设计目标

CCP 联邦化协议（基于 ActivityPub 简化模型）实现多 CCP 节点间的能力索引共享，使得：

- 节点 A 可以搜索节点 B 注册的能力锚点
- 节点间交换索引摘要（不传输完整数据）
- 手动注册节点，信任权重可配置

### 8.2 联邦节点

**节点信息（GET /federation）**：

```json
{
  "protocol": "CCP",
  "version": "v1.0.0",
  "node": {
    "id": "ccp.example.com",
    "name": "示例节点",
    "endpoint": "https://ccp.example.com/api/ccp/v1",
    "capabilities_count": 21,
    "features": ["search", "telemetry", "federation", "adapters"],
    "federation_policy": "manual"
  }
}
```

**节点管理**：

| 操作     | 方法   | 端点                     | 说明                                         |
| -------- | ------ | ------------------------ | -------------------------------------------- |
| 列出节点 | GET    | `/federation/nodes`      | 按 trust_weight 降序                         |
| 注册节点 | POST   | `/federation/nodes`      | 手动注册，提供 id/name/endpoint/trust_weight |
| 移除节点 | DELETE | `/federation/nodes/{id}` | 级联删除索引缓存                             |

**节点状态**：`active`（活跃）/ `inactive`（停用）/ `suspended`（已挂起）

### 8.3 索引摘要交换

```
POST /api/ccp/v1/federation/exchange
```

节点间交换能力锚点索引摘要，只传输最小元数据集：

| 请求字段                       | 说明                                           |
| ------------------------------ | ---------------------------------------------- |
| `node.id`                      | 节点标识                                       |
| `node.endpoint`                | 节点端点                                       |
| `capabilities[].id`            | 能力锚点 ID                                    |
| `capabilities[].name`          | 能力名称                                       |
| `capabilities[].category`      | 能力分类                                       |
| `capabilities[].trust_summary` | 信任向量摘要（usage_rate/success/uncertainty） |

未注册节点返回 403。

### 8.4 联邦搜索

```
GET /api/ccp/v1/search?q={keyword}&federated=true
```

`federated=true` 时，搜索同时覆盖本地索引和联邦索引缓存。联邦结果标记 `_source: "federated"` 和 `_source_node`。

### 8.5 数据库 Schema

```sql
-- 联邦节点表
CREATE TABLE federation_nodes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  description TEXT,
  trust_weight REAL DEFAULT 0.5,
  status TEXT DEFAULT 'active',
  capabilities_count INTEGER DEFAULT 0,
  last_seen TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- 联邦索引缓存表
CREATE TABLE federation_index_cache (
  node_id TEXT NOT NULL,
  capability_id TEXT NOT NULL,
  name TEXT,
  category TEXT,
  trust_usage_rate REAL,
  trust_success REAL,
  trust_uncertainty REAL,
  cached_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (node_id, capability_id),
  FOREIGN KEY (node_id) REFERENCES federation_nodes(id) ON DELETE CASCADE
);
```

---

## 九、API 端点总览

```
# 能力锚点
GET  /api/ccp/v1/capabilities
GET  /api/ccp/v1/capabilities/{id}
GET  /api/ccp/v1/capabilities/{id}/adapters/{framework}

# 搜索
GET  /api/ccp/v1/search?q={keyword}[&federated=true]

# 遥测
POST /api/ccp/v1/telemetry

# 联邦
GET    /api/ccp/v1/federation
GET    /api/ccp/v1/federation/nodes
POST   /api/ccp/v1/federation/nodes
DELETE /api/ccp/v1/federation/nodes/{id}
POST   /api/ccp/v1/federation/exchange
```

---

## 十、许可

CCP 协议文本采用 [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) 许可。参考实现代码采用 [MIT](https://opensource.org/licenses/MIT) 许可。
