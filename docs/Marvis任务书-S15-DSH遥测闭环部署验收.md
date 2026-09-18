# Marvis 任务：S15 DSH 遥测闭环 部署验收

> **任务来源**：S15 DSH 遥测闭环开发完成，185 测试全通过
> **交付日期**：2026-09-18
> **优先级**：P0（信任向量网络效应的技术闭环基础）
> **依赖**：无（DB 迁移 + 代码已就绪，直接部署即可）

---

## 一、背景

DSH 插件安装后，运行时调用能力产生遥测数据，但这些数据没有自动回传到 CCP。导致 `evidence.count` 始终为 0，信任向量永远静止。

**S15 解决了这个问题**——在 DSH 适配器 YAML 中注入 `telemetry` 节，插件调用成功后自动 POST 到 CCP，CCP 接收后更新 `evidence.count` 和 `uncertainty`，实现信任向量动态演化。

## 二、你的任务

### 任务 1：执行 DB 迁移

**文件**：[migrations/0012_s15_dsh_telemetry_source.sql](file:///d:/SkillMesh---插台/migrations/0012_s15_dsh_telemetry_source.sql)

**操作**：在 Cloudflare D1 控制台执行该 SQL 文件，或通过 wrangler CLI：

```bash
wrangler d1 execute skillmesh-db --file=migrations/0012_s15_dsh_telemetry_source.sql
```

**验证**：执行 `PRAGMA table_info(telemetry_records);` 确认 `source` 和 `dsh_plugin_id` 列存在。

---

### 任务 2：部署到 Cloudflare Pages

```bash
wrangler pages deploy
```

部署后确认 Functions 版本已更新（检查仪表盘 → Workers & Pages → 最新部署时间）。

---

### 任务 3：验证 DSH 适配器含遥测节

```bash
curl https://skillmesh.礼字号.中国/api/ccp/v1/capabilities/pdf-extract-text-001/adapters/dsh
```

**验收标准**：YAML 输出中必须包含 `telemetry:` 节点，含 `source: dsh`、`dsh_plugin_id`、`endpoint` 字段。

---

### 任务 4：验证遥测 POST 端点

```bash
# 4a：Agent 直传（source=direct）
curl -X POST https://skillmesh.礼字号.中国/api/ccp/v1/telemetry \
  -H "Content-Type: application/json" \
  -d '{"capability_id":"pdf-extract-text-001","agent_id":"test-001","success":true,"source":"direct","latency_ms":42}'

# 4b：DSH 插件回传（source=dsh）
curl -X POST https://skillmesh.礼字号.中国/api/ccp/v1/telemetry \
  -H "Content-Type: application/json" \
  -d '{"capability_id":"pdf-extract-text-001","agent_id":"dsh-pdf-extract-text-001","success":true,"source":"dsh","dsh_plugin_id":"pdf-extract-text-001","latency_ms":75}'

# 4c：非法 source 应回退为 direct
curl -X POST https://skillmesh.礼字号.中国/api/ccp/v1/telemetry \
  -H "Content-Type: application/json" \
  -d '{"capability_id":"pdf-extract-text-001","agent_id":"test","success":true,"source":"hacker","latency_ms":10}'
```

**验收标准**：

- 4a/4b 返回 200，响应 JSON 含 `source` 字段正确取值（direct / dsh）
- 4c 返回 200，`source` 自动降级为 `"direct"`
- 响应含 `updated.evidence_count` 且 > 0

---

### 任务 5：验证遥测 GET 列表端点

```bash
# 全部记录
curl https://skillmesh.礼字号.中国/api/ccp/v1/telemetry

# 按 dsh 来源筛选
curl "https://skillmesh.礼字号.中国/api/ccp/v1/telemetry?source=dsh"

# 按 direct 来源筛选
curl "https://skillmesh.礼字号.中国/api/ccp/v1/telemetry?source=direct"

# 限制条数
curl "https://skillmesh.礼字号.中国/api/ccp/v1/telemetry?limit=5"
```

**验收标准**：

- 返回 200，JSON 含 `records` 数组和 `summary` 统计对象
- `records[].source` 为 `"direct"` 或 `"dsh"`
- `records[].success` 为 `true`/`false`（布尔值）
- `summary.total` 等于 records 总数
- `?source=dsh` 筛选仅返回 dsh 来源记录

---

### 任务 6：验证 DSH YAML 示例含遥测回传代码

```bash
curl https://skillmesh.礼字号.中国/api/ccp/v1/capabilities/pdf-extract-text-001/adapters/dsh
```

**验收标准**：YAML 底部注释区含 `遥测回传（DSH→CCP 闭环）` 段，含 `curl` 遥测回传示例。

---

### 任务 7：验证健康面板含 by_source

```bash
curl https://skillmesh.礼字号.中国/api/ccp/v1/health
```

**验收标准**：`telemetry.by_source` 字段存在，含 `direct` 和 `dsh` 计数。确认与步骤 5 的记录数量一致。

---

### 任务 8：端到端闭环测试

1. 用 `dsh install` 安装任意 CCP 能力锚点（如 `pdf-extract-text-001`）
2. 调用该插件一次
3. 立即查询 `GET /api/ccp/v1/telemetry?source=dsh`，确认出现一条新记录
4. 查询 `GET /api/ccp/v1/capabilities/pdf-extract-text-001`，确认 `evidence.count` 增加了 1

---

## 三、验收清单

| #   | 检查点                | 预期                          | 实际 |
| --- | --------------------- | ----------------------------- | ---- |
| 1   | DB migration 执行     | source / dsh_plugin_id 列存在 | ☐    |
| 2   | Pages 部署成功        | 最新部署时间 < 5 分钟         | ☐    |
| 3   | DSH YAML 含 telemetry | YAML 含 `telemetry:` 节点     | ☐    |
| 4   | POST telemetry 200    | source 字段正确               | ☐    |
| 5   | GET telemetry 列表    | records + summary             | ☐    |
| 6   | source 筛选           | 正确筛选 direct/dsh           | ☐    |
| 7   | YAML 遥测示例         | 底部含回传 curl               | ☐    |
| 8   | health by_source      | 含 direct/dsh 分布            | ☐    |
| 9   | dsh install 闭环      | 调用后 evidence.count++       | ☐    |

---

## 四、回滚方案

如果部署后有异常：

1. DB 迁移不可逆（新增列），如需回退数据用 `ALTER TABLE telemetry_records DROP COLUMN source`（D1 不支持 ALTER，需重建表）
2. 代码回退到上一个 commit，重新部署 Pages
3. 影响面：`source` 字段缺失只会导致旧客户端遥测落库时该列为 `direct`（默认值），不影响功能

---

## 五、可复制粘贴内容

**Checklist（复制到任务系统）：**

```
S15 部署验收
□ 1. 执行 DB migration
□ 2. 部署到 Pages
□ 3. curl DSH YAML → 含 telemetry 节
□ 4. curl POST telemetry (source=direct) → 200
□ 5. curl POST telemetry (source=dsh) → 200
□ 6. curl GET /telemetry → records + summary
□ 7. curl GET /telemetry?source=dsh → 仅 dsh 记录
□ 8. curl GET /health → telemetry.by_source
□ 9. dsh install → 调用 → GET telemetry → evidence.count++
```
