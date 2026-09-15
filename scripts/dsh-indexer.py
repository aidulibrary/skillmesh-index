#!/usr/bin/env python3
"""
S12-D — DSH Plugin Indexer
=============================
扫描本地 ~/.deepseek-harness/plugins 目录，读取 plugin.yaml，
转换为 SkillMesh CCP CapabilityAnchor 格式。

用法：
    python scripts/dsh-indexer.py [--plugins-dir ~/.deepseek-harness/plugins] [--output dsh-capabilities.json]

依赖：
    pip install pyyaml

输出：
    CCP CapabilityAnchor JSON 数组，可直接注册到 SkillMesh API。

设计原则：
    - 每个 DSH 插件 → 一个 CapabilityAnchor，endpointType = "dsh-local"
    - 插件 capabilities 列表 → features 字段
    - 插件 metadata 的 description、author、version → 对应 CCP 字段
    - 如果 plugin.yaml 中定义了 endpoint/protocol，保留为自定义扩展字段
"""

import argparse
import json
import os
import sys
import hashlib
from datetime import datetime, timezone

try:
    import yaml
except ImportError:
    print("错误：缺少 pyyaml 依赖。请运行：pip install pyyaml", file=sys.stderr)
    sys.exit(1)


def resolve_plugins_dir(path=None):
    if path:
        return os.path.expanduser(path)
    candidates = [
        os.path.join(os.path.expanduser("~"), ".deepseek-harness", "plugins"),
        os.path.join(os.path.expanduser("~"), ".dsh", "plugins"),
    ]
    for c in candidates:
        if os.path.isdir(c):
            return c
    print(f"警告：未找到 DSH 插件目录（搜索路径：{', '.join(candidates)}）", file=sys.stderr)
    return None


def load_plugin_yaml(plugin_dir_path, plugin_dir_name):
    yaml_path = os.path.join(plugin_dir_path, "plugin.yaml")
    if not os.path.isfile(yaml_path):
        return None
    try:
        with open(yaml_path, "r", encoding="utf-8") as f:
            return yaml.safe_load(f)
    except Exception as e:
        print(f"警告：无法解析 {yaml_path}：{e}", file=sys.stderr)
        return None


def to_capability_anchor(plugin, plugin_dir_name):
    meta = plugin.get("metadata") or plugin.get("meta") or {}
    caps = plugin.get("capabilities", [])
    name = plugin.get("name") or plugin_dir_name

    desc_raw = meta.get("description") or plugin.get("description") or name
    desc_en = desc_raw if isinstance(desc_raw, str) else str(desc_raw)

    features = []
    for c in caps:
        if isinstance(c, dict):
            label = c.get("name", "") or c.get("id", "")
            detail = c.get("description", "")
            features.append(f"{label}: {detail}" if detail else label)
        elif isinstance(c, str):
            features.append(c)

    anchor_id = hashlib.sha256(f"dsh-{plugin_dir_name}".encode()).hexdigest()[:12]

    return {
        "id": f"dsh-{anchor_id}",
        "name": name,
        "name_en": desc_en[:120],
        "desc": desc_en[:500],
        "desc_en": desc_en[:500],
        "category": "dsh-plugin",
        "endpoint": f"dsh://{plugin_dir_name}",
        "endpointType": "dsh-local",
        "trustScore": 50,
        "features": features[:10],
        "provenance": {
            "source": "deepseek-harness",
            "pluginDir": plugin_dir_name,
            "author": str(meta.get("author", "")),
            "version": str(meta.get("version", "0.1.0")),
            "indexedAt": datetime.now(timezone.utc).isoformat(),
        },
        "custom": {
            "dshProtocol": plugin.get("protocol", ""),
            "dshEndpoint": plugin.get("endpoint", ""),
        },
    }


def scan_plugins(plugins_dir):
    anchors = []
    if not plugins_dir or not os.path.isdir(plugins_dir):
        return anchors

    for entry in os.listdir(plugins_dir):
        plugin_path = os.path.join(plugins_dir, entry)
        if not os.path.isdir(plugin_path):
            continue

        plugin = load_plugin_yaml(plugin_path, entry)
        if plugin is None:
            continue

        try:
            anchor = to_capability_anchor(plugin, entry)
            anchors.append(anchor)
            print(f"  ✓ {entry} → {anchor['id']} ({len(anchor['features'])} features)")
        except Exception as e:
            print(f"  ✗ {entry}：转换失败 — {e}", file=sys.stderr)

    return anchors


def main():
    parser = argparse.ArgumentParser(
        description="DSH Plugin Indexer — 将本机 DSH 插件转为 SkillMesh CCP 能力锚点"
    )
    parser.add_argument(
        "--plugins-dir",
        default=None,
        help="DSH 插件目录路径（默认自动探测 ~/.deepseek-harness/plugins）",
    )
    parser.add_argument(
        "--output",
        default=None,
        help="输出 JSON 文件路径（默认输出到 stdout）",
    )
    parser.add_argument(
        "--register",
        action="store_true",
        help="同时注册到 SkillMesh API（需要 API 密钥环境变量 SKILLMESH_API_KEY）",
    )
    parser.add_argument(
        "--api-base",
        default="http://localhost:8788/api/ccp/v1",
        help="SkillMesh API 基础地址（配合 --register 使用）",
    )
    args = parser.parse_args()

    plugins_dir = resolve_plugins_dir(args.plugins_dir)
    if not plugins_dir:
        print("错误：未找到 DSH 插件目录。请用 --plugins-dir 指定路径。", file=sys.stderr)
        sys.exit(1)

    print(f"DSH 插件目录：{plugins_dir}", file=sys.stderr)
    print(f"开始扫描...\n", file=sys.stderr)

    anchors = scan_plugins(plugins_dir)

    if not anchors:
        print("未发现任何插件。", file=sys.stderr)
        result = {"capabilities": [], "total": 0, "source": "dsh-indexer"}
    else:
        result = {
            "capabilities": anchors,
            "total": len(anchors),
            "source": "dsh-indexer",
            "indexedAt": datetime.now(timezone.utc).isoformat(),
        }

    output_json = json.dumps(result, ensure_ascii=False, indent=2)

    if args.output:
        with open(args.output, "w", encoding="utf-8") as f:
            f.write(output_json)
        print(f"\n已写入 {args.output}（{len(anchors)} 个能力锚点）", file=sys.stderr)
    else:
        print(output_json)

    if args.register and anchors:
        print("\n--- 注册到 SkillMesh ---", file=sys.stderr)
        import urllib.request

        api_key = os.environ.get("SKILLMESH_API_KEY", "")
        for anchor in anchors:
            try:
                req = urllib.request.Request(
                    f"{args.api_base}/contribute",
                    data=json.dumps(anchor).encode("utf-8"),
                    headers={
                        "Content-Type": "application/json",
                        "Authorization": f"Bearer {api_key}",
                    },
                    method="POST",
                )
                resp = urllib.request.urlopen(req)
                print(f"  ✓ {anchor['id']} 注册成功 ({resp.status})", file=sys.stderr)
            except Exception as e:
                print(f"  ✗ {anchor['id']} 注册失败：{e}", file=sys.stderr)


if __name__ == "__main__":
    main()