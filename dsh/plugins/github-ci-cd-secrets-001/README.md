---
AIGC:
    Label: "1"
    ContentProducer: 001191440300708461136T1XGW3
    ProduceID: 0c5caf7145ca8876d640e5da87215fbf_035d9f45a7ac11f1b3f6525400826444
    ReservedCode1: lRCSVbq7uYH0ZBhzV2Z2+6sMQq23QvxyhPmBCLsWd9ZkDeWqkfRYWMIXVKOAo/1lB2A/Ui+gJXj3BEI0AOzpbzbTQqbHk8c3cciMBudr39gCxso8XsTuaBIQzMaXzly+ZBpFpRSJnFL0Nkl9RNEi+pU7rEYDrtBAhXN2zwVy815D/jfO2kWOz5dP78E=
    ContentPropagator: 001191440300708461136T1XGW3
    PropagateID: 0c5caf7145ca8876d640e5da87215fbf_035d9f45a7ac11f1b3f6525400826444
    ReservedCode2: lRCSVbq7uYH0ZBhzV2Z2+6sMQq23QvxyhPmBCLsWd9ZkDeWqkfRYWMIXVKOAo/1lB2A/Ui+gJXj3BEI0AOzpbzbTQqbHk8c3cciMBudr39gCxso8XsTuaBIQzMaXzly+ZBpFpRSJnFL0Nkl9RNEi+pU7rEYDrtBAhXN2zwVy815D/jfO2kWOz5dP78E=
---

# github-ci-cd-secrets-001 (DSH skill 插件)

由 CCP 能力锚点导出的 DSH 插件清单（kind: skill），用于 GitHub CI/CD 密钥配置自动化。

## 包内容

| 文件 | 说明 |
| --- | --- |
| `plugin.yaml` | DSH 插件清单（apiVersion: deepseek.io/plugin/v1，kind: skill） |

源锚点：`ccp-spec/anchors/github-ci-cd-secrets-001.json`
生成时间：2026-09-03T15:24:12Z（导出时项目内无独立 plugin.yaml schema，字段按 CCP-v0.1 §10.2-10.3 + DSH 市场规划 §5.1-5.3 约定映射，prompt/requires/trust 为约定字段）

## 能力摘要

- 细粒度 PAT 公钥加密写入 Actions Secrets（PyNaCl libsodium sealed box）
- Git Data API 推送代码与 workflow（绕过被重置的 git 通道，workflows 最后推送）
- 空提交触发 push 型 workflow
- 403 权限诊断与 CI run 轮询、线上站点验证

## 安装（本地 / 直连文件）

```bash
dsh plugin add --config ./dsh/plugins/github-ci-cd-secrets-001/plugin.yaml
# 或
dsh plugin add https://<host>/dsh/plugins/github-ci-cd-secrets-001/plugin.yaml
```

## 私有化插件市场 / registry 发布

项目规划（docs/DeepSeek-Harness 插件市场：超级开发规划与执行策略*.md）采用本地优先 +
多源 registry 聚合，暂无可执行发布脚本。建议步骤：

1. **打包与验证**：确认 `plugin.yaml` 字段完整（metadata/prompt/input/output/requires/trust），本地 `dsh plugin add --config` 安装试跑。
2. **源码分发**：将 `dsh/plugins/` 目录推送至私有 Git 仓库（如企业内部 GitHub/GitLab），registry 聚合器扫描该源生成 catalog 条目。
3. **静态 Catalog（零成本）**：将 catalog JSON 发布到私有 GitHub Pages / 对象存储 CDN，客户端执行 `dsh market add <catalog-url>` 后 `dsh market install github-ci-cd-secrets-001 --reproducible`。
4. **OCI 分发（企业级）**：推送插件包到私有 OCI Registry（如 ghcr.io / Harbor），`dsh market install <registry>/github-ci-cd-secrets-001:1.0.0`。
5. **运行时注入**：使用方 Harness 需提供 `GITHUB_TOKEN` 环境变量（Secrets=Read and write），并放行 `api.github.com` 出站网络。

## 使用前提

- 目标仓库存在；PAT 需在 GitHub Developer settings 授予 Secrets=Read and write（仅 Administration 不够，写 secrets 会 403）。
*（内容由AI生成，仅供参考）*
