# M2：联邦节点真实化 — Marvis 执行任务书

> 交付对象：@Marvis
> 版本：v2.0（基于 S15/S16 完成后的最新基线重写）
> 日期：2026-09-18
> 优先级：P0（核心假设验证的最后一块拼图）
> 前置条件：全部满足 ✅
>
> | 前置项                       | 状态            |
> | ---------------------------- | --------------- |
> | S13 CCP API + DSH 短 URL     | ✅ 已部署       |
> | S14 债务清仓 T1-T4           | ✅ 已部署       |
> | S15 DSH 遥测闭环             | ✅ 已部署       |
> | S16 静态数据统一（21↔21↔D1） | ✅ 已部署       |
> | 联邦注册/交换/搜索 API       | ✅ 已实现并在线 |
> | 健康面板联邦状态视图         | ✅ 已上线       |
> | CONTRIBUTING.md 贡献指南     | ✅ 已就绪       |
> | 当前线上联邦节点数           | **0**           |

---

## 0. 背景：为什么这件事至关重要

### 0.1 核心假设

SkillMesh / 插台 是一个**实验性协议项目**，试图回答一个问题：

> 当 AI Agent 面对成千上万个能力时，如何自动找到真正靠谱的那一个？

答案假设是**"信任向量网络效应"**：

```
联邦节点越多 → 交叉验证的遥测数据越丰富
                → 信任向量（evidence.count、uncertainty）越精确
                → Agent 决策越可靠
                → 更多开发者愿意接入
                → 更多联邦节点
```

**但这个循环从未被验证过。**

### 0.2 当前基线（硬数据）

```
联邦节点数：          0（演示节点已于 S14 清理）
外部贡献者：          0（库内仅 2 条 bot/seeder 记录）
联邦交换记录：        0
遥测记录：            0 条真实调用（仅有开发者测试数据）
能力锚点总数：        34 条（全部来自主节点种子导入）
```

**整个项目的核心假设，建立在零个真实外部节点的基础上。**

### 0.3 技术底子（已完成，Marvis 不需要碰这些）

以下基础设施已全部实现并部署上线，Marvis **不需要**做任何技术工作：

| 组件             | 状态 | 说明                                                     |
| ---------------- | ---- | -------------------------------------------------------- |
| 联邦节点注册 API | ✅   | `POST /api/ccp/v1/federation/nodes/{id}/register`        |
| 联邦节点列表 API | ✅   | `GET /api/ccp/v1/federation/nodes`                       |
| 联邦节点删除 API | ✅   | `DELETE /api/ccp/v1/federation/nodes/{id}`               |
| 联邦交换协议     | ✅   | `POST /api/ccp/v1/federation/exchange`（节点间索引同步） |
| 联邦搜索         | ✅   | 搜索时自动合并联邦节点结果                               |
| 健康面板         | ✅   | `health.html` 实时显示联邦节点状态和遥测分布             |
| 能力锚点模板     | ✅   | CONTRIBUTING.md 含完整 JSON 模板和字段说明               |
| DSH 遥测闭环     | ✅   | 插件调用后自动回传遥测，动态更新信任向量                 |
| OpenAPI 文档     | ✅   | `api-docs.html` 含全部端点文档和 curl/JS/Python 示例     |

**Marvis 的任务纯属推广运营，零技术门槛。**

---

## 1. 任务目标

**唯一目标：吸引 ≥ 1 个真实外部开发者注册联邦节点。**

| 级别  | 条件                 | 验证方式                                                                             |
| ----- | -------------------- | ------------------------------------------------------------------------------------ |
| 🥉 铜 | 1 个真实外部节点注册 | `curl https://skillmesh.pages.dev/api/ccp/v1/health` → `total_nodes >= 1`            |
| 🥈 银 | 2+ 个外部节点注册    | `total_nodes >= 2`                                                                   |
| 🥇 金 | 1 次联邦交换成功     | `curl https://skillmesh.pages.dev/api/ccp/v1/health` → `federation_exchanges` 有记录 |

---

## 2. 项目简介（可直接复制粘贴用于推广）

### 中文版（适合 V2EX / 微信群 / 即刻）

```
SkillMesh / 插台 — 给 AI Agent 的能力加一个"信任评分"

AI Agent 每天都在调用各种工具：PDF 解析、网页抓取、代码执行……
但问题是——同一个功能可能有十几个实现，Agent 该选哪个？

SkillMesh 是一个轻量级协议实验：
1. 用 10 行 JSON 描述你的 AI 能力（叫"能力锚点"）
2. 系统自动评估信任度（来源、成功率、风险、时效）
3. 跨联邦节点搜索，信任高的优先展示
4. 一键导出 MCP Server / LangChain Tool / DSH Plugin 格式

项目状态：
- 协议规范：CCP v1.0.0（已发布）
- 在线 API：https://skillmesh.pages.dev/api/ccp/v1
- 当前能力锚点：34 个
- 联邦节点：0（正在寻找第一个！）
- 代码：https://github.com/aidulibrary/skillmesh-index

我们需要第一个联邦节点来验证"信任向量网络效应"假设。
如果你有一个 AI 能力（MCP Server / API / 脚本 / Prompt 都行），
花 5 分钟注册，帮助验证一个有趣的想法 ⚡
```

### English (for Twitter / Reddit / Hacker News)

```
SkillMesh — A trust layer for AI Agent capabilities

Your AI Agent calls dozens of tools daily. But which implementation
should it trust when there are 10 "PDF extractors" available?

SkillMesh is an experimental protocol that:
1. Lets you describe any AI capability with ~10 lines of JSON
2. Automatically computes a trust vector (source, success rate, risk, freshness)
3. Enables cross-node federated search with trust-weighted ranking
4. Exports adapters for MCP, LangChain, DSH Plugin — one click

Current state:
- Protocol: CCP v1.0.0
- Live API: https://skillmesh.pages.dev/api/ccp/v1
- Registered capabilities: 34
- Federation nodes: 0 (looking for the first one!)
- Repo: https://github.com/aidulibrary/skillmesh-index

We need the first external federation node to validate the
"trust vector network effect" hypothesis. If you have an AI capability
(MCP server, API, script, or prompt), 5 minutes is all it takes.
```

---

## 3. 执行步骤

### 第一步：技术验证（15 分钟）

Marvis 先确认注册端点可用，并亲自走一遍完整流程。以下命令**直接复制粘贴到终端**即可：

```bash
# 1. 确认当前联邦节点数为 0
curl -s https://skillmesh.pages.dev/api/ccp/v1/health | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log('total_nodes:', d.summary?.total_nodes || d.stats?.federation?.total_nodes)"

# 2. 注册一个临时测试节点
curl -s -X POST https://skillmesh.pages.dev/api/ccp/v1/federation/nodes/marvis-test-001/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Marvis 测试节点","endpoint":"https://skillmesh.pages.dev/api/ccp/v1","capabilities_count":34,"description":"M2 任务第一步验证"}' | node -e "process.stdin.on('data',d=>console.log(JSON.parse(d)))"

# 3. 验证注册成功（应显示节点信息）
curl -s https://skillmesh.pages.dev/api/ccp/v1/federation/nodes/marvis-test-001 | node -e "process.stdin.on('data',d=>console.log(JSON.parse(d)))"

# 4. 验证健康面板更新
curl -s https://skillmesh.pages.dev/api/ccp/v1/health | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log('total_nodes:', d.summary?.total_nodes || d.stats?.federation?.total_nodes)"

# 5. 清理测试节点（完成后必须清空）
curl -s -X DELETE https://skillmesh.pages.dev/api/ccp/v1/federation/nodes/marvis-test-001 | node -e "process.stdin.on('data',d=>console.log(JSON.parse(d)))"

# 6. 确认清空（应回到 0）
curl -s https://skillmesh.pages.dev/api/ccp/v1/health | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log('total_nodes:', d.summary?.total_nodes || d.stats?.federation?.total_nodes)"
```

**验证通过标准**：步骤 3 返回节点信息，步骤 4 显示 `total_nodes: 1`，步骤 6 显示 `total_nodes: 0`。

### 第二步：社区推广发帖（2-3 小时）

#### 渠道 A：V2EX（优先）

- **目标板块**：`/go/ai`（AI 节点）或 `/go/create`（创造者节点）
- **标题**：
  ```
  [实验项目] SkillMesh — 给 AI Agent 的能力加一个"信任评分"，招募第一个联邦节点
  ```
- **正文**：直接使用上文 **"中文版"** 简介，附加：

  ```
  接入方式（5 分钟）：
  1. 打开 https://github.com/aidulibrary/skillmesh-index/blob/main/CONTRIBUTING.md
  2. 复制 JSON 模板，填入你的能力信息
  3. Fork → 创建分支 → 提交 PR
  4. 或直接用 API 注册（一行 curl）

  我不是这个项目的开发者，只是帮忙推广。开发者已经把技术底子搭好了，
  现在就是缺第一个真实的外部节点来验证核心假设。如果你有兴趣，
  留个言或直接看 CONTRIBUTING.md，有问题我帮你联系开发者。
  ```

- **预期效果**：100-500 次浏览，1-3 个潜在开发者联系

#### 渠道 B：即刻 / Reddit

- **即刻**：发布在 AI 相关圈子，使用中文简介
- **Reddit**：发布在 `r/aiagents` / `r/mcp` / `r/LangChain`，使用英文简介
- **标题建议（Reddit）**：
  ```
  [Experiment] SkillMesh — A trust scoring layer for AI Agent tools.
  Looking for the first federation node.
  ```

#### 渠道 C：GitHub Discussions

- **操作**：在 `aidulibrary/skillmesh-index` 仓库的 Discussions 中创建帖子
- **类别**：Announcements 或 General
- **标题**：
  ```
  🧭 招募第一个联邦节点 — SkillMesh 信任向量网络效应验证
  ```
- **正文**：中英双语简介 + 接入指南链接

#### 渠道 D（可选）：微信群 / Discord

- 如果有目标 AI 开发者微信群，直接发中文简介
- 如果有 Discord 社区（LangChain / MCP / Dify），发英文简介
- **如果没有 Discord 群**：暂不创建，等有 3+ 个活跃外部开发者后再考虑建群

### 第三步：引导外部开发者完成注册

当有人表达兴趣时，Marvis 执行以下引导流程：

```
1. 确认对方能力类型：
   → MCP Server？→ API？→ 脚本？→ Prompt 模板？
   → 所有类型都可以注册为能力锚点。endpointType 填 mcp/http/command/prompt 即可。

2. 发送 CONTRIBUTING.md 链接：
   → https://github.com/aidulibrary/skillmesh-index/blob/main/CONTRIBUTING.md
   → 提醒对方：第 6 步的"信任向量评分指南"很重要，不要全填 1.0。

3. 协助对方完成注册（二选一）：

   方式 A（推荐，走 PR）：
   → Fork 仓库 → 在 js/data.js 中新增一条 → 提交 PR
   → 优点：永久保存，审核后自动纳入主节点数据库

   方式 B（快速，走 API）：
   → 直接 POST 注册联邦节点
   → curl -X POST https://skillmesh.pages.dev/api/ccp/v1/federation/nodes/{对方节点ID}/register \
       -H "Content-Type: application/json" \
       -d '{"name":"对方节点名称","endpoint":"对方节点端点","capabilities_count":N}'
   → 优点：即时生效，无需等待 PR 审核

4. 验证注册结果：
   → 打开 https://skillmesh.pages.dev/health.html
   → 确认"联邦节点"卡片从"empty"变为显示节点数 > 0
   → 截图保存，作为 M2 验收证据

5. 收集反馈：
   → 接入过程是否顺利？哪里卡住了？
   → 最困惑的是什么？
   → 对信任向量的直观感受？
   → 愿意推荐给其他人吗？
```

### 第四步：验收记录

注册成功后，Marvis 更新本任务书末尾的验收模板，并截图 `/health` 面板作为证据。

---

## 4. 常见问题（FAQ，可直接发给外部开发者）

### Q1：我需要部署什么吗？

**不需要。** 你只需要准备一条 JSON 描述你的能力，然后通过 API 注册或提交 PR。不用部署服务器，不用注册账号，不用安装任何东西。

### Q2：注册后我的能力数据会被"拿走"吗？

**不会。** 你注册的只是**元数据**（名称、描述、分类、信任评分），不包含任何代码或数据。端点地址是你自己的，调用入口完全由你控制。SkillMesh 只做索引和信任评估。

### Q3：CCP 和 MCP 是什么关系？

**互补关系。** MCP 负责"怎么调用"，CCP 负责"该信哪个"。一个 Agent 可以先用 CCP 搜索找到最靠谱的能力，再用 MCP 去实际调用它。

### Q4：我是独立开发者，只有一个很小的工具，值得注册吗？

**完全值得。** 联邦节点的价值不在于规模，而在于多样性。一个小众但高质量的工具，在联邦搜索中可能比大而全的通用工具排名更高——因为信任向量会奖励精确匹配和高成功率。

### Q5：注册后可以删除吗？

**可以。** `DELETE /api/ccp/v1/federation/nodes/{你的节点ID}` 即可完全移除，所有关联的缓存索引也会一并清理。

---

## 5. 交付标准

| #   | 标准               | 阈值                                      | 权重 |
| --- | ------------------ | ----------------------------------------- | ---- |
| 1   | 技术验证通过       | 完整执行注册→验证→删除流程，确认端点可用  | 必须 |
| 2   | 推广渠道执行       | ≥ 2 个渠道发帖（V2EX 必须执行，其余任选） | 必须 |
| 3   | 首个外部节点注册   | ≥ 1 个非 Marvis 非开发者的真实节点        | 核心 |
| 4   | `/health` 面板状态 | 从 `empty` 变为 `healthy`（nodes > 0）    | 核心 |
| 5   | 外部开发者反馈     | ≥ 1 条反馈记录（好坏均可）                | 推荐 |
| 6   | 联邦交换记录       | ≥ 1 条 `federation_exchanges` 记录        | 银级 |

---

## 6. 时间建议

| 阶段    | 内容                                       | 预计耗时           | 建议日期 |
| ------- | ------------------------------------------ | ------------------ | -------- |
| Day 1   | 第一步：技术验证（curl 走通注册/删除流程） | 15 分钟            | 立即     |
| Day 1   | 第二步：V2EX 发帖                          | 30 分钟            | 立即     |
| Day 1-2 | 第二步：Reddit / GitHub Discussions 发帖   | 30 分钟/渠道       | Day 1-2  |
| Day 2-7 | 第三步：跟进回复和私信                     | 持续，每次 10 分钟 | Day 2-7  |
| 注册后  | 第四步：验收记录                           | 15 分钟            | 注册日   |

---

## 7. 验收模板

```
### M2 联邦节点真实化 — 验收报告

- 日期：2026-09-__
- 执行人：Marvis

### 第一步：技术验证
- 注册端点可用：✅ / ❌
- 验证节点信息返回：✅ / ❌
- 健康面板更新：✅ / ❌
- 删除清理成功：✅ / ❌

### 第二步：社区推广
1. V2EX：已发帖 / 待发 / 跳过   链接：_______
2. Reddit：已发帖 / 待发 / 跳过  链接：_______
3. GitHub Discussions：已发帖 / 待发 / 跳过  链接：_______
4. 即刻/微信/Discord：已发帖 / 待发 / 跳过

### 第三步：外部开发者引导
- 表达兴趣的开发者数：__
- 实际完成注册的外部节点数：__
- 注册方式：PR / API
- 外部节点 ID：_______
- 外部节点名称：_______
- 开发者反馈摘要：

### 第四步：线上验证
- /health 面板 total_nodes：__
- /health 面板状态：empty / healthy / degraded
- 联邦交换记录：有（__ 条） / 无
- https://skillmesh.pages.dev/health.html 截图：已保存 / 未保存

### 结论
✅ 铜级 / ✅ 银级 / ✅ 金级 / ❌ 未达标

### 备注
1.
2.
```
