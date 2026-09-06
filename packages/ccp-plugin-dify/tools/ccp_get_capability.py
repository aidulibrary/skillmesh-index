"""
CCP Get Capability — Dify 工具
获取指定能力锚点的详细信息。
"""

from collections.abc import Generator
from typing import Any
from dify_plugin import Tool
from dify_plugin.entities.tool import ToolInvokeMessage


class CcpGetCapabilityTool(Tool):
    def _invoke(
        self,
        tool_parameters: dict[str, Any],
    ) -> Generator[ToolInvokeMessage, None, None]:
        capability_id = tool_parameters.get("capability_id", "")

        provider = self.session.provider
        result = provider.get_capability(capability_id)

        trust = result.get("trust_radar", {})
        overall = trust.get("overall", "N/A")

        lines = [
            f"## {result.get('name', capability_id)}（{result.get('name_en', '')}）",
            f"**ID**: {result.get('id', '')}",
            f"**分类**: {result.get('category', '')}",
            f"**描述**: {result.get('desc', '')}",
            f"**端点**: {result.get('endpoint', '')}",
            f"**端点类型**: {result.get('endpointType', '')}",
            f"**版本**: {result.get('version', 1)}",
            "",
            f"### 信任向量",
            f"综合信任分: **{overall}**",
        ]

        if trust.get("dimensions"):
            for dim in trust["dimensions"]:
                lines.append(
                    f"  - {dim['name']}: {dim['value']} (权重 {dim['weight']})"
                )

        lines.append(f"\n证据量: {trust.get('evidence_count', 0)}")
        lines.append(f"不确定性: {trust.get('uncertainty', 'N/A')}")

        yield self.create_text_message("\n".join(lines))