# dsh-plugin-ccp

DSH 插件：CCP 协议能力发现层。

## 安装

```bash
dsh plugin install dsh-plugin-ccp
```

## 配置

```bash
dsh config set ccp.endpoint https://skillmesh.礼字号.中国/api/ccp/v1
dsh config set ccp.federated true
```

## 提供的工具

| 工具            | 功能                          |
| --------------- | ----------------------------- |
| `ccp_search`    | 搜索能力锚点（支持中文/英文） |
| `ccp_detail`    | 获取能力详情 + 信任向量       |
| `ccp_telemetry` | 回传调用结果（信任向量闭环）  |

## 使用示例

```python
# DSH Agent 中使用 CCP 发现能力
result = ccp_search("pdf text extraction")
for cap in result["results"]:
    print(f"{cap['name']} — trust: {cap['trust']['success']:.0%}")

# 获取详情
detail = ccp_detail("pdf-extract-text-001")

# 回传调用结果
ccp_telemetry("pdf-extract-text-001", success=True, latency_ms=120)
```

## 许可

MIT
