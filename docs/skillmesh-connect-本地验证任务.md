# skillmesh-connect 本地 DeepSeek-Harness 配置安装及使用验证任务

> **版本**：v1.0 | **日期**：2026-09-18 | **依赖**：S19 `skillmesh-connect` 已推送  
> **目标**：在本地 DeepSeek-Harness 中完整接入 SkillMesh CCP 能力注册表，端到端验证搜索→安装→调用闭环

---

## 一、环境前置检查

| 检查项     | 命令                                                                                                                 | 最低版本 | 通过    |
| ---------- | -------------------------------------------------------------------------------------------------------------------- | -------- | ------- | --- | ----------------- | --- | --------------------------------- | -------- | --- |
| Node.js    | `node --version`                                                                                                     | ≥ 18.0.0 | ☐       |
| npm        | `npm --version`                                                                                                      | ≥ 9.0.0  | ☐       |
| DSH CLI    | `dsh --version`                                                                                                      | ≥ 0.8.0  | ☐       |
| 网络连通性 | `node -e "fetch('https://skillmesh.pages.dev/api/ccp/v1/capabilities').then(r=>r.json()).then(j=>console.log(j.count |          | j.total |     | j.results?.length |     | Object.keys(j).length+' keys'))"` | 返回数字 | ☐   |

> **注意**：如果 `dsh` 命令不存在，需要先安装 DeepSeek-Harness Desktop 或 CLI。  
> 参考：[hairyf/deepseek-harness-desktop](https://github.com/hairyf/deepseek-harness-desktop)

---

## 二、启动 skillmesh-connect 本地连接器

### 方式 A：npx 一键启动（推荐）

```bash
# 默认端口 9999，连接生产环境 SkillMesh
npx skillmesh-connect
```

### 方式 B：从项目源码启动

```bash
cd packages/skillmesh-connect
node src/index.js --port=9999
```

### 可选参数

```bash
npx skillmesh-connect --port=8888 --refresh=600 --host=https://skillmesh.pages.dev
```

| 参数        | 默认值                        | 说明                       |
| ----------- | ----------------------------- | -------------------------- |
| `--port`    | `9999`                        | 本地监听端口               |
| `--host`    | `https://skillmesh.pages.dev` | SkillMesh 上游地址         |
| `--refresh` | `300`                         | Catalog 自动刷新间隔（秒） |

### 启动成功标志

```
╔══════════════════════════════════════════════════════╗
║         SkillMesh Connect v1.0.0                      ║
║  CCP → DeepSeek-Harness 本地连接器                     ║
╠══════════════════════════════════════════════════════╣
║  Local:  http://localhost:9999                        ║
║  Catalog: http://localhost:9999/catalog.json          ║
║  Health:  http://localhost:9999/health                ║
╠══════════════════════════════════════════════════════╣
║  Harness 接入命令：                                     ║
║  dsh market add http://localhost:9999/catalog.json    ║
╚══════════════════════════════════════════════════════╝
  ✅ 已加载 N 项 CCP 能力锚点
```

| 验证项                | 操作                                                                                                                      | 预期                                                   |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| ☐ catalog.json 可访问 | 浏览器打开 `http://localhost:9999/catalog.json`                                                                           | 返回 JSON，`kind: "Catalog"`                           |
| ☐ health 端点正常     | `node -e "fetch('http://localhost:9999/health').then(r=>r.json()).then(console.log)"`                                     | `status: "ok"`, `catalog_total > 0`                    |
| ☐ DSH 适配器可代理    | `node -e "fetch('http://localhost:9999/dsh/http-ip-geo-021.yaml').then(r=>r.text()).then(t=>console.log(t.slice(0,80)))"` | 返回以 `apiVersion: deepseek.io/plugin/v1` 开头的 YAML |
| ☐ 上游连接正常        | 观察终端日志                                                                                                              | `[SkillMesh Connect] Catalog 已刷新` 无报错            |

---

## 三、注册 Catalog 到 DeepSeek-Harness

```bash
# 核心命令：将 SkillMesh catalog 注册为本地插件市场源
dsh market add http://localhost:9999/catalog.json
```

预期输出：

```
Market source added: skillmesh (v1.0.0)
  Source: http://localhost:9999/catalog.json
  Entries: N
  Type: Catalog
  Status: active
```

| 验证项         | 命令                                        | 预期                            |
| -------------- | ------------------------------------------- | ------------------------------- |
| ☐ 市场源已添加 | `dsh market list`                           | 列表中包含 `skillmesh` 源       |
| ☐ 市场源信息   | `dsh market info skillmesh`                 | 显示条目数、来源 URL            |
| ☐ 能力可见     | `dsh market search "IP" --source skillmesh` | 返回 http-ip-geo-021 等匹配结果 |

---

## 四、端到端验证流程

### Step 1：浏览可用能力

```bash
# 查看 SkillMesh catalog 中的所有能力
dsh market list --source skillmesh

# 搜索特定能力
dsh market search "github" --source skillmesh
dsh market search "secrets" --source skillmesh
dsh market search "geo" --source skillmesh
```

| 验证项         | 命令                                                   | 预期                      |
| -------------- | ------------------------------------------------------ | ------------------------- |
| ☐ 列出全部     | `dsh market list --source skillmesh`                   | 返回 N 项能力清单         |
| ☐ 搜索（英文） | `dsh market search "pdf" --source skillmesh`           | 返回 pdf-extract-text-001 |
| ☐ 搜索（中文） | `dsh market search "提取" --source skillmesh`          | 返回文本提取相关能力      |
| ☐ 搜索（分类） | `dsh market search --category data --source skillmesh` | 返回 data 分类下的能力    |

### Step 2：安装一个能力到本地 Harness

```bash
# 以 http-ip-geo-021 为例（零配置、无需认证）
dsh market install http-ip-geo-021 --source skillmesh

# 或从 DSH adapter URL 直接安装
dsh plugin add http://localhost:9999/dsh/http-ip-geo-021.yaml
```

| 验证项     | 命令                                                    | 预期                         |
| ---------- | ------------------------------------------------------- | ---------------------------- |
| ☐ 安装成功 | `dsh market install http-ip-geo-021 --source skillmesh` | 输出安装成功，提示可用工具   |
| ☐ 插件可见 | `dsh plugin list`                                       | 列表中包含 `http-ip-geo-021` |
| ☐ 插件详情 | `dsh plugin info http-ip-geo-021`                       | 显示版本、描述、信任分数     |

### Step 3：使用已安装的能力

```bash
# 启动 DSH 交互式会话
dsh chat

# 在会话中调用 IP 地理查询能力
> 查询 IP 8.8.8.8 的地理位置
```

或者在代码中使用：

```python
# Python SDK 调用
from dsh import Harness

harness = Harness()
# 使用已安装的 http-ip-geo-021 插件
result = harness.call("http-ip-geo-021", ip="8.8.8.8")
print(result)
```

| 验证项                       | 预期                                  |
| ---------------------------- | ------------------------------------- |
| ☐ Harness 能发现已安装的能力 | 会话中 Agent 自动加载 http-ip-geo-021 |
| ☐ 能力调用成功               | 返回 IP 地理信息（国家/城市/ISP）     |
| ☐ 信任向量显示               | 能力结果中附带 trust score            |

### Step 4：安装第二个能力（GitHub Secrets）

```bash
# 安装需要配置环境变量的能力
dsh market install github-ci-cd-secrets-001 --source skillmesh

# 配置 PAT（按需）
dsh config set plugin.github-ci-cd-secrets-001.GITHUB_TOKEN "github_pat_xxx"
```

| 验证项       | 命令                                                             | 预期                            |
| ------------ | ---------------------------------------------------------------- | ------------------------------- |
| ☐ 安装成功   | `dsh market install github-ci-cd-secrets-001 --source skillmesh` | 提示需要 GITHUB_TOKEN 环境变量  |
| ☐ 配置项可见 | `dsh plugin info github-ci-cd-secrets-001`                       | 列出 required env: GITHUB_TOKEN |

---

## 五、与 dsh-plugin-ccp 互补验证

`skillmesh-connect`（catalog 源）和 `dsh-plugin-ccp`（Agent 工具）可以同时使用，提供互补的能力发现路径：

```bash
# 路径 A：catalog 安装（永久接入）
dsh market install http-ip-geo-021 --source skillmesh

# 路径 B：Agent 工具搜索（运行时发现）
dsh plugin install dsh-plugin-ccp
dsh config set ccp.endpoint https://skillmesh.pages.dev/api/ccp/v1
```

| 验证项                  | 命令                                              | 预期                                                   |
| ----------------------- | ------------------------------------------------- | ------------------------------------------------------ |
| ☐ dsh-plugin-ccp 已安装 | `dsh plugin install dsh-plugin-ccp`               | 安装成功，注册 ccp_search / ccp_detail / ccp_telemetry |
| ☐ ccp_search 可用       | 启动 dsh chat，输入 `ccp_search "pdf extraction"` | 返回 SkillMesh 中的匹配能力                            |
| ☐ ccp_detail 可用       | `ccp_detail "pdf-extract-text-001"`               | 返回能力详情 + 信任向量                                |
| ☐ 两条路径不冲突        | catalog 安装的能力 + Agent 工具搜索的能力共存     | Harness 中同时可见两种来源的能力                       |

---

## 六、故障排查

| 症状                             | 原因                                  | 解决                                                                                       |
| -------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------ |
| `dsh` 命令不存在                 | DeepSeek-Harness 未安装               | 安装 [hairyf/deepseek-harness-desktop](https://github.com/hairyf/deepseek-harness-desktop) |
| `npx skillmesh-connect` 找不到包 | 包未发布到 npm                        | 使用方式 B：`cd packages/skillmesh-connect && node src/index.js`                           |
| Catalog 显示 0 项能力            | 上游 SkillMesh 不可达                 | 检查网络：`curl https://skillmesh.pages.dev/api/ccp/v1/capabilities`                       |
| `dsh market add` 返回连接错误    | 本地端口被防火墙阻止                  | 确认 `localhost:9999` 可访问，换端口 `--port=8888`                                         |
| 安装能力后无法调用               | Harness runtime 不支持 `kind: Plugin` | 检查 DSH 版本 ≥ 0.8.0                                                                      |
| DSH adapter 代理 404             | 能力 ID 不匹配（连字符/下划线）       | 使用 `dsh market search` 确认正确的能力名称                                                |
| 上游连接超时                     | 网络环境限制                          | 设置 `--host=https://skillmesh.礼字号.中国` 尝试备用域名                                   |

---

## 七、验证完成清单

| 编号 | 检查项                                                       | 通过 |
| ---- | ------------------------------------------------------------ | ---- |
| V1   | 环境三要素通过（Node.js + npm + DSH CLI）                    | ☐    |
| V2   | `skillmesh-connect` 启动成功，加载 N 项能力                  | ☐    |
| V3   | `/catalog.json` 返回正确 DSH catalog 格式                    | ☐    |
| V4   | `/health` 返回 `status: ok`                                  | ☐    |
| V5   | `/dsh/{id}.yaml` 返回 DSH plugin.yaml                        | ☐    |
| V6   | `dsh market add` 成功注册 SkillMesh catalog                  | ☐    |
| V7   | `dsh market list --source skillmesh` 显示 N 项能力           | ☐    |
| V8   | `dsh market search "geo" --source skillmesh` 返回匹配结果    | ☐    |
| V9   | `dsh market install http-ip-geo-021 --source skillmesh` 成功 | ☐    |
| V10  | `dsh plugin list` 中包含已安装的能力                         | ☐    |
| V11  | Harness 会话中成功调用已安装能力                             | ☐    |
| V12  | `dsh-plugin-ccp` 与 catalog 互补不冲突                       | ☐    |

---

## 八、清理

```bash
# 移除市场源
dsh market remove skillmesh

# 卸载已安装的能力
dsh plugin remove http-ip-geo-021
dsh plugin remove github-ci-cd-secrets-001

# 停止本地连接器（Ctrl+C）
```

---

> **下一步**：S18 能力采集引擎 — Cloudflare Worker Cron 定时采集 DeepSeek 官方 API + GitHub MCP 开源生态，自动导入 SkillMesh。
