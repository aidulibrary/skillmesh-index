---
AIGC:
    Label: "1"
    ContentProducer: 001191440300708461136T1XGW3
    ProduceID: 0c5caf7145ca8876d640e5da87215fbf_a322c89db35c11f185dc525400de85a5
    ReservedCode1: 7V3IcbcENayqnEFp7kZHUGAyDa+G7AMRPEWKlJG1a6rINVw1mFqg2EiPDzVOXslf/qIXHpf4iWJ98VMee+w2AsayjQENOFffjNWVBPs96ftBqsw5ZJJ8/K6rG8v8ALeUiafEVQIgiWOmiVg65hq33miqn9pbJjhcBAFgyAebb+vf10v6tcb8i8UYSjc=
    ContentPropagator: 001191440300708461136T1XGW3
    PropagateID: 0c5caf7145ca8876d640e5da87215fbf_a322c89db35c11f185dc525400de85a5
    ReservedCode2: 7V3IcbcENayqnEFp7kZHUGAyDa+G7AMRPEWKlJG1a6rINVw1mFqg2EiPDzVOXslf/qIXHpf4iWJ98VMee+w2AsayjQENOFffjNWVBPs96ftBqsw5ZJJ8/K6rG8v8ALeUiafEVQIgiWOmiVg65hq33miqn9pbJjhcBAFgyAebb+vf10v6tcb8i8UYSjc=
---



# skillmesh-connect

SkillMesh CCP → DeepSeek-Harness 本地连接器。一键启动本地 DSH catalog 代理，将 SkillMesh 能力注册表（CCP 协议）接入本地 Harness，无需手动改配置。

## 安装与启动

方式 A（推荐）：npx 一键启动

```bash
npx skillmesh-connect
```

方式 B：本地源码启动

```bash
git clone https://github.com/aidulibrary/skillmesh-index.git
cd packages/skillmesh-connect
node src/index.js --port=9999
```

## 用法

启动后默认监听 `http://127.0.0.1:9999`，提供：

| 路径             | 说明                                        |
| ---------------- | ------------------------------------------- |
| `/catalog`       | SkillMesh 能力目录代理（实时拉取上游注册表） |
| `/health`        | 健康检查                                    |
| `/adapters/yaml` | DSH adapter YAML 代理                       |

上游默认 `https://skillmesh.礼字号.中国`，可用环境变量覆盖：

| 变量名            | 默认值                                | 说明             |
| ----------------- | ------------------------------------- | ---------------- |
| `CCP_ENDPOINT`    | `https://skillmesh.礼字号.中国`       | 上游 CCP API     |
| `PORT`            | `9999`                                | 本地监听端口     |
| `CATALOG_PATH`    | `/api/ccp/v1/catalog`                 | 能力目录路径     |

## 能力

- 实时代理 SkillMesh CCP 能力注册表（catalog_total 当前 34 项）
- 将 SkillMesh 能力注册表接入本地 DeepSeek Harness
- 适配 DSH adapter YAML 格式（含 `minHarnessVersion` 版本线说明）

## 许可

MIT © CCP Community / SkillMesh
*（内容由AI生成，仅供参考）*
*（内容由AI生成，仅供参考）*
