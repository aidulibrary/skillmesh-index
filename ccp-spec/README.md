# CCP — 能力通约协议

> **Capability Commensurability Protocol**
> 使异构系统间能力请求与能力执行得以对接的最小通约协议

[![CCP Version](https://img.shields.io/badge/CCP-v1.0.0-blue)](SPEC.md)
[![License](https://img.shields.io/badge/license-CC%20BY--SA%204.0-green)](https://creativecommons.org/licenses/by-sa/4.0/)
[![OpenAPI](https://img.shields.io/badge/OpenAPI-3.1.0-85C1E9)](ccp-openapi.yaml)

---

## 为什么需要 CCP

当前 AI 能力生态面临三重名实乖离：

1. **"插件"之名遮蔽了"能力通约"之实**：以"可安装的代码包"定义插件，混淆了分发形态与能力本质。
2. **"工具声明"之名遮蔽了"认知能力"之实**：Agent 需要的不是"调用 parse_pdf"这个操作，而是"理解 PDF 内容"这个认知结果。
3. **"发布者身份"之名遮蔽了"能力可信度"之实**：调用方不关心能力来自谁，只关心能力是否可靠、是否可用。

CCP 协议将这三重误认消解，将"插件"重构为"能力锚点"——一个让 Agent 能够**发现、评估、调用、路由**能力的最小协议。

**核心原则**：协议优先于平台。CCP 本身是公共基础设施，不绑定任何特定实现、平台或分发渠道。

---

## 快速导航

| 文档                                     | 说明                   |
| ---------------------------------------- | ---------------------- |
| [SPEC.md](SPEC.md)                       | 完整协议规范（v1.0.0） |
| [ccp-openapi.yaml](ccp-openapi.yaml)     | OpenAPI 3.1.0 规范     |
| [IMPLEMENTATIONS.md](IMPLEMENTATIONS.md) | 已知 CCP 实现          |
| [ADOPTERS.md](ADOPTERS.md)               | 已接入的 Agent 框架    |
| [CHANGELOG.md](CHANGELOG.md)             | 版本历史               |

---

## 协议核心

### 能力锚点（Capability Anchor）

CCP 协议的基本操作单元。不包含代码、不包含安装脚本、不包含运行时环境——只包含让调用方能够**发现、评估、调用**该能力所需的最小元数据集。

```json
{
  "id": "pdf-extract-text-001",
  "name": "PDF文本提取",
  "name_en": "PDF Text Extraction",
  "endpoint": "mcp://pymupdf-server/extract-text",
  "endpointType": "mcp",
  "category": "data",
  "trustSource": 0.92,
  "trustSuccess": 0.97
}
```

### 四大操作

| 操作              | 说明                                            | 端点                                          |
| ----------------- | ----------------------------------------------- | --------------------------------------------- |
| **发现** Discover | 关键词搜索 + 语义搜索 + 联邦搜索                | `GET /search`                                 |
| **评估** Evaluate | 五维信任向量 + 证据层                           | `GET /capabilities/{id}`                      |
| **调用** Invoke   | 统一调用 Schema                                 | `endpoint` + `endpointType`                   |
| **路由** Route    | 代码生成 / 浏览器试用 / Agent 适配器 / 能力编排 | `GET /capabilities/{id}/adapters/{framework}` |

### 信任向量

区别于传统"星级评分"，采用多维向量替代单一分数：

| 维度         | 权重 | 说明                     |
| ------------ | ---- | ------------------------ |
| 源码可验证性 | 0.25 | 声明是否可追溯到源码     |
| 使用痕迹     | 0.15 | 归一化调用次数           |
| 成功率       | 0.30 | 历史调用成功率           |
| 依赖风险     | 0.15 | 依赖链复杂度（越低越好） |
| 时效性       | 0.15 | 能力数据时效性           |

---

## 参考实现

| 实现      | 地址                          | 说明                         |
| --------- | ----------------------------- | ---------------------------- |
| SkillMesh | https://skillmesh.礼字号.中国 | 主节点，CCP v1.0.0 参考实现  |
| CCP SDK   | `@skillmesh/ccp-client`       | JavaScript/TypeScript 客户端 |

---

## 参与贡献

- **能力锚点提交**：通过参考实现的 GitHub Issue 模板或 Pull Request 提交
- **协议修改**：通过 GitHub Discussion 发起提案
- **实现贡献**：提交新的 CCP 实现到 [IMPLEMENTATIONS.md](IMPLEMENTATIONS.md)

---

## 许可

CCP 协议文本采用 [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) 许可。参考实现代码采用 [MIT](https://opensource.org/licenses/MIT) 许可。
