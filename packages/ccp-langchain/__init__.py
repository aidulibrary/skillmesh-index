"""CCP LangChain 集成包 — 将 CCP 能力锚点封装为 LangChain Tool。"""

from .ccp_tool import CCPToolkit, CCPSearchTool, CCPDetailTool

__all__ = ["CCPToolkit", "CCPSearchTool", "CCPDetailTool"]
__version__ = "0.1.0"
