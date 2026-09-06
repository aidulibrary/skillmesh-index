"""
CCP Get Adapter — Dify 工具
获取指定能力锚点的框架适配器，含可运行示例。
"""

from collections.abc import Generator
from typing import Any
from dify_plugin import Tool
from dify_plugin.entities.tool import ToolInvokeMessage


class CcpGetAdapterTool(Tool):
    def _invoke(
        self,
        tool_parameters: dict[str, Any],
    ) -> Generator[ToolInvokeMessage, None, None]:
        capability_id = tool_parameters.get("capability_id", "")
        framework = tool_parameters.get("framework", "langchain")

        provider = self.session.provider
        result = provider.get_adapter(capability_id, framework)

        examples = result.get("_examples", {})
        lines = [
            f"## {framework} 适配器 — {capability_id}",
            f"```json",
            str(result),
            f"```",
        ]

        if examples:
            lines.append(f"\n### 可运行示例")
            if examples.get("curl"):
                lines.append(f"\n**cURL**:\n```bash\n{examples['curl']}\n```")
            if examples.get("python"):
                lines.append(f"\n**Python**:\n```python\n{examples['python']}\n```")
            if examples.get("javascript"):
                lines.append(
                    f"\n**JavaScript**:\n```javascript\n{examples['javascript']}\n```"
                )

        yield self.create_text_message("\n".join(lines))