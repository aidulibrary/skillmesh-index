"""
CCP Search — Dify 工具
搜索 CCP 联邦网络中的能力锚点。
"""

from collections.abc import Generator
from typing import Any
from dify_plugin import Tool
from dify_plugin.entities.tool import ToolInvokeMessage


class CcpSearchTool(Tool):
    def _invoke(
        self,
        tool_parameters: dict[str, Any],
    ) -> Generator[ToolInvokeMessage, None, None]:
        query = tool_parameters.get("query", "")
        federated = tool_parameters.get("federated", False)

        provider = self.session.provider
        result = provider.search(query, federated)

        count = result.get("count", 0)
        capabilities = result.get("results", [])

        if count == 0:
            yield self.create_text_message(
                f"未找到与「{query}」相关的能力锚点。试试其他关键词？"
            )
            return

        lines = [f"找到 {count} 个与「{query}」相关的能力锚点：\n"]
        for cap in capabilities[:10]:
            trust = cap.get("_semanticScore", cap.get("trustSource", "N/A"))
            lines.append(
                f"- **{cap.get('id', 'N/A')}** — {cap.get('name', '')} "
                f"（{cap.get('category', '')}）"
                f"\n  {cap.get('desc', '')[:100]}"
                f"\n  信任分: {trust}"
            )
        yield self.create_text_message("\n".join(lines))