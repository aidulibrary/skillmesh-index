## 贡献类型

- [ ] 新增能力锚点
- [ ] 修改现有能力锚点
- [ ] 修复数据错误
- [ ] 文档/协议更新
- [ ] 其他

## 变更说明

请简要描述本次变更内容。

## 能力锚点清单（如适用）

| ID               | 名称     | 分类 | 端点类型 |
| ---------------- | -------- | ---- | -------- |
| example-tool-021 | 示例工具 | data | mcp      |

## 信任向量自查

- [ ] 已填写 `trustSource`（源码可验证性，0-1）
- [ ] 已填写 `trustSuccess`（成功率，基于实际测试，0-1）
- [ ] 已填写 `trustRisk`（依赖风险，越低越好，0-1）
- [ ] 已填写 `trustTime`（时效性，基于 lastUpdated 自动计算）
- [ ] 已填写 `evidence.count`（证据量，初始为 0）
- [ ] 已填写 `evidence.uncertainty`（不确定性，初始约 0.5）
- [ ] `provenance` 指向真实可访问的源码仓库（非 example.com）
- [ ] `endpoint` 为真实可用的端点地址

## Schema 校验

- [ ] 本地运行 `node -e "..."` 验证通过（参考 `.github/workflows/schema-validate.yml`）
- [ ] `id` 格式符合 `{name}-{variant}-{seq}` 规范（如 `pdf-extract-text-001`）
- [ ] 所有必填字段已填写

## 附加说明

如有其他需要审核者关注的信息，请在此补充。
