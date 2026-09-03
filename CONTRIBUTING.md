# 贡献能力锚点

感谢你为 SkillMesh 生态贡献能力锚点！

## 贡献流程

### 1. 准备数据

在 `js/data.js` 中新增一条能力锚点记录，参考现有格式：

```javascript
{
  id: "your-tool-name-021",
  name: "你的工具名称",
  name_en: "Your Tool Name",
  desc: "简短描述，说明这个能力做什么",
  desc_en: "Brief description of what this capability does",
  input: "输入参数说明",
  input_en: "Input parameter description",
  output: "输出结果说明",
  output_en: "Output description",
  endpoint: "mcp://your-server/action",
  endpointType: "mcp",
  category: "data",
  provenance: "https://github.com/your/repo",
  trustSource: 0.7,
  trustUsage: 0,
  trustUsageRate: 0.0,
  trustSuccess: 0.9,
  trustRisk: 0.2,
  trustTime: 0.8,
  lastUpdated: "2026-08-29",
  evidence: { count: 0, uncertainty: 0.5 },
  features: ["特性1", "特性2"],
  features_en: ["Feature 1", "Feature 2"],
  usageGuide: "使用说明",
  usageGuide_en: "Usage guide",
  codeExample: '{ "method": "tools/call", "params": { "name": "your-action", "arguments": {} } }',
}
```

### 2. 校验数据

确保你的数据符合 Schema 规范：

```bash
# 安装校验工具（可选）
npm install -g ajv-cli

# 校验
ajv validate -s schemas/capability-anchor.json -d your-capability.json
```

### 3. 字段要求

| 字段                        | 必填 | 说明                                                     |
| --------------------------- | ---- | -------------------------------------------------------- |
| `id`                        | ✅   | 格式 `{name}-{variant}-{seq}`，如 `pdf-extract-text-001` |
| `name` / `name_en`          | ✅   | 中英文名称                                               |
| `desc` / `desc_en`          | ✅   | 中英文描述                                               |
| `input` / `output`          | ✅   | 输入输出说明                                             |
| `endpoint` / `endpointType` | ✅   | 端点 URI 和类型                                          |
| `category`                  | ✅   | 分类：`data` / `media` / `language` / `ai` / `dev`       |
| `trustSource` ~ `trustTime` | ✅   | 信任向量五维评分                                         |
| `provenance`                | 推荐 | 源码仓库地址                                             |
| `features` / `features_en`  | 推荐 | 功能特性列表                                             |
| `codeExample`               | 推荐 | 调用示例                                                 |

### 4. 提交 PR

1. Fork 本仓库
2. 创建分支：`git checkout -b cap/your-tool-name`
3. 提交变更：`git commit -m "feat: add capability anchor for your-tool-name"`
4. 推送分支：`git push origin cap/your-tool-name`
5. 创建 Pull Request 到 `main` 分支

### 5. 审核标准

PR 合并需满足：

- [ ] 数据格式符合 Schema 规范
- [ ] `id` 不与现有能力锚点冲突
- [ ] 信任向量评分合理（非全 1.0）
- [ ] `provenance` 指向真实可访问的仓库
- [ ] 中英文描述完整

### 6. 信任向量评分指南

| 维度         | 0.0-0.3     | 0.4-0.6  | 0.7-0.8  | 0.9-1.0    |
| ------------ | ----------- | -------- | -------- | ---------- |
| trustSource  | 闭源/无源码 | 部分开源 | 完全开源 | 可复现构建 |
| trustSuccess | 不稳定      | 偶尔失败 | 通常成功 | 极其可靠   |
| trustRisk    | 高风险依赖  | 有风险   | 低风险   | 零依赖     |
| trustTime    | 已废弃      | 停止维护 | 活跃维护 | 持续更新   |
