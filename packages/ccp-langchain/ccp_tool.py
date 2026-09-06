"""
CCP LangChain Tool — 将 CCP 协议能力锚点封装为 LangChain Tool。
"""
import json
import urllib.request
import urllib.parse
from typing import Optional, List
from langchain_core.tools import BaseTool
from pydantic import BaseModel, Field


class CCPSearchInput(BaseModel):
    query: str = Field(description="搜索关键词")
    category: Optional[str] = Field(None, description="能力分类过滤")


class CCPDetailInput(BaseModel):
    capability_id: str = Field(description="能力锚点ID")


class CCPSearchTool(BaseTool):
    name: str = "ccp_search"
    description: str = "搜索 CCP 协议中的 AI 能力锚点。返回能力列表含信任评分。"
    args_schema: type = CCPSearchInput
    base_url: str = "https://skillmesh.礼字号.中国/api/ccp/v1"

    def _run(self, query: str, category: Optional[str] = None) -> str:
        params = f"?q={urllib.parse.quote(query)}"
        if category:
            params += f"&category={urllib.parse.quote(category)}"
        return self._fetch(f"/search{params}")

    def _fetch(self, path: str) -> str:
        url = f"{self.base_url}{path}"
        req = urllib.request.Request(url, headers={"Accept": "application/json"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read())
        results = data.get("results", [])
        if not results:
            return "未找到匹配的能力锚点。"
        lines = [f"找到 {len(results)} 个能力："]
        for r in results[:5]:
            trust = r.get("trustSource", 0.5)
            lines.append(f"- {r['id']}: {r['name']} (信任: {trust:.0%})")
        return "\n".join(lines)


class CCPDetailTool(BaseTool):
    name: str = "ccp_detail"
    description: str = "获取指定 CCP 能力锚点的完整详情和调用端点。"
    args_schema: type = CCPDetailInput
    base_url: str = "https://skillmesh.礼字号.中国/api/ccp/v1"

    def _run(self, capability_id: str) -> str:
        return self._fetch(f"/capabilities/{urllib.parse.quote(capability_id)}")

    def _fetch(self, path: str) -> str:
        url = f"{self.base_url}{path}"
        req = urllib.request.Request(url, headers={"Accept": "application/json"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read())
        cap = data.get("capability") or data
        return json.dumps({
            "id": cap.get("id"), "name": cap.get("name"),
            "desc": cap.get("desc"), "endpoint": cap.get("endpoint"),
            "endpointType": cap.get("endpointType"),
            "trust": cap.get("trustSource", 0.5),
        }, ensure_ascii=False, indent=2)


class CCPToolkit:
    """CCP LangChain 工具集。"""

    def __init__(self, base_url: str = "https://skillmesh.礼字号.中国/api/ccp/v1"):
        self.base_url = base_url

    def get_tools(self) -> List[BaseTool]:
        return [
            CCPSearchTool(base_url=self.base_url),
            CCPDetailTool(base_url=self.base_url),
        ]
