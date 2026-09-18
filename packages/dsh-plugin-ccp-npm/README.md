# dsh-plugin-ccp

DSH Cordis 插件：CCP 协议能力发现层。

## 安装

```bash
npm install dsh-plugin-ccp
```

## Cordis 模式

```javascript
import { App } from "cordis";
import * as ccpPlugin from "dsh-plugin-ccp";

const app = new App();
app.plugin(ccpPlugin, { endpoint: "https://skillmesh.pages.dev/api/ccp/v1" });
```

## 独立模式

```javascript
import { ccp_search, ccp_detail, ccp_telemetry } from "dsh-plugin-ccp";

const results = await ccp_search("pdf extraction");
const detail = await ccp_detail("pdf-extract-text-001");
await ccp_telemetry("pdf-extract-text-001", true, 120);
```

## 遥测包装器

```javascript
import { telemetryWrapper } from "dsh-plugin-ccp";
const result = await telemetryWrapper(() => someCall(), "capability-id");
```

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `CCP_ENDPOINT` | CCP API 端点 | `https://skillmesh.礼字号.中国/api/ccp/v1` |
| `CCP_FEDERATED` | 启用联邦搜索 | `false` |

## 许可

MIT © CCP Community
