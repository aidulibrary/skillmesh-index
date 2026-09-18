"""
DSH Plugin CCP — CCP 协议能力发现层

让 DSH Agent 通过 CCP 协议搜索、评估、调用能力锚点。

提供三个 DSH 工具：
- ccp_search: 搜索能力锚点
- ccp_detail: 获取能力详情 + 生成适配器
- ccp_telemetry: 回传调用结果（信任向量闭环）

版本：v1.0.0
协议：CCP v1.0.0
"""

import os
import json
import time
import urllib.parse
import urllib.request
import urllib.error
from typing import Optional


def _normalize_endpoint(endpoint: str) -> str:
    """将端点 URL 规范化：非 ASCII 主机名转为 IDNA（punycode）编码。

    Python urllib 不支持含非 ASCII 字符的 hostname（会抛 latin-1 编码错误），
    需在发起请求前把中文域名转换为 punycode 形式（如 礼字号.中国 -> xn--...）。
    """
    parts = urllib.parse.urlsplit(endpoint)
    hostname = parts.hostname
    if hostname and any(ord(c) > 127 for c in hostname):
        ascii_host = hostname.encode("idna").decode("ascii")
        if ":" in hostname or (parts.port is not None):
            ascii_host = f"{ascii_host}:{parts.port}"
        netloc = ascii_host
        if parts.username:
            userinfo = parts.username
            if parts.password:
                userinfo += f":{parts.password}"
            netloc = f"{userinfo}@{ascii_host}"
        return urllib.parse.urlunsplit(
            (parts.scheme, netloc, parts.path, parts.query, parts.fragment)
        )
    return endpoint

CCP_ENDPOINT = os.environ.get(
    "CCP_ENDPOINT", "https://skillmesh.礼字号.中国/api/ccp/v1"
)
CCP_FEDERATED = os.environ.get("CCP_FEDERATED", "false").lower() == "true"


class CCPClient:
    """CCP API HTTP 客户端"""

    def __init__(self, endpoint: str = CCP_ENDPOINT):
        self.endpoint = _normalize_endpoint(endpoint).rstrip("/")

    def _request(self, path: str, method: str = "GET", body: Optional[dict] = None) -> dict:
        url = f"{self.endpoint}{path}"
        data = json.dumps(body).encode("utf-8") if body else None
        req = urllib.request.Request(
            url,
            data=data,
            headers={
                "Content-Type": "application/json",
                "Accept": "application/json",
                "User-Agent": "dsh-plugin-ccp/1.0.0",
            },
            method=method,
        )
        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            return {"error": {"code": "HTTP_ERROR", "detail": str(e), "status": e.code}}
        except Exception as e:
            return {"error": {"code": "NETWORK_ERROR", "detail": str(e)}}

    def search(self, q: str, category: Optional[str] = None) -> dict:
        """搜索能力锚点"""
        params = f"?q={urllib.parse.quote(q)}"
        if category:
            params += f"&category={urllib.parse.quote(category)}"
        if CCP_FEDERATED:
            params += "&federated=true"
        return self._request(f"/search{params}")

    def detail(self, capability_id: str) -> dict:
        """获取能力锚点详情"""
        return self._request(f"/capabilities/{urllib.parse.quote(capability_id)}")

    def adapter(self, capability_id: str, framework: str = "dsh") -> dict:
        """获取适配器代码（服务端返回 YAML 文本）"""
        url = (
            f"{self.endpoint}/capabilities/{urllib.parse.quote(capability_id)}"
            f"/adapters/{urllib.parse.quote(framework)}"
        )
        req = urllib.request.Request(
            url,
            headers={
                "Accept": "text/yaml,text/plain,*/*",
                "User-Agent": "dsh-plugin-ccp/1.0.0",
            },
            method="GET",
        )
        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                return {"adapter": resp.read().decode("utf-8"), "framework": framework}
        except urllib.error.HTTPError as e:
            return {"error": {"code": "HTTP_ERROR", "detail": str(e), "status": e.code}}
        except Exception as e:
            return {"error": {"code": "NETWORK_ERROR", "detail": str(e)}}

    def telemetry(
        self,
        capability_id: str,
        success: bool,
        latency_ms: int = 0,
        source: str = "dsh",
        dsh_plugin_id: Optional[str] = None,
    ) -> dict:
        """回传调用结果（S15：DSH 遥测闭环 — 自动标记来源）"""
        body = {
            "capability_id": capability_id,
            "success": success,
            "latency_ms": latency_ms,
            "agent_id": "dsh-plugin-ccp",
            "source": source,
        }
        if dsh_plugin_id:
            body["dsh_plugin_id"] = dsh_plugin_id
        return self._request("/telemetry", method="POST", body=body)

    def list_capabilities(self, category: Optional[str] = None) -> dict:
        """列出所有能力锚点"""
        params = ""
        if category:
            params = f"?category={urllib.parse.quote(category)}"
        return self._request(f"/capabilities{params}")

    def node_info(self) -> dict:
        """获取节点信息"""
        return self._request("/node")


_client = CCPClient()


def ccp_search(q: str, category: Optional[str] = None) -> dict:
    """
    DSH 工具：搜索能力锚点。

    通过 CCP 协议搜索 AI 能力，返回能力锚点列表（含信任向量）。

    Args:
        q: 搜索关键词（中文或英文）
        category: 能力分类过滤（ai/data/media/language/dev），可选

    Returns:
        包含 results 列表和 count 的字典，每个结果包含 id/name/desc/trust 向量
    """
    result = _client.search(q, category)
    if "error" in result:
        return {"error": result["error"], "results": [], "count": 0}

    summary = []
    for cap in result.get("results", []):
        summary.append(
            {
                "id": cap.get("id"),
                "name": cap.get("name"),
                "name_en": cap.get("name_en"),
                "desc": cap.get("desc"),
                "category": cap.get("category"),
                "endpoint_type": cap.get("endpointType"),
                "trust": {
                    "source": cap.get("trustSource"),
                    "usage_rate": cap.get("trustUsageRate"),
                    "success": cap.get("trustSuccess"),
                    "risk": cap.get("trustRisk"),
                    "time": cap.get("trustTime"),
                },
            }
        )

    return {
        "query": result.get("query", q),
        "count": len(summary),
        "federated": result.get("federated", False),
        "results": summary,
    }


def ccp_detail(capability_id: str) -> dict:
    """
    DSH 工具：获取能力锚点详情。

    获取指定能力的完整信息，包括端点、输入输出规格、信任向量和证据层。

    Args:
        capability_id: 能力锚点 ID（如 pdf-extract-text-001）

    Returns:
        完整的能力锚点对象
    """
    result = _client.detail(capability_id)
    if "error" in result:
        return {"error": result["error"]}
    return result


def ccp_telemetry(capability_id: str, success: bool, latency_ms: int = 0, source: str = "dsh", dsh_plugin_id: Optional[str] = None) -> dict:
    """
    DSH 工具：回传调用结果到 CCP 遥测端点。

    每次 Agent 调用能力后应回传结果，以维护信任向量的准确性。
    S15 新增：自动标记遥测来源为 dsh，确保 DSH 遥测闭环。

    Args:
        capability_id: 能力锚点 ID
        success: 调用是否成功
        latency_ms: 调用延迟（毫秒）
        source: 遥测来源（默认 dsh，表示 DSH 插件回传）
        dsh_plugin_id: DSH 插件标识（可选）

    Returns:
        确认信息
    """
    result = _client.telemetry(capability_id, success, latency_ms, source, dsh_plugin_id)
    if "error" in result:
        return {"error": result["error"], "acknowledged": False}
    return {"acknowledged": True, "capability_id": capability_id, "source": source}


def telemetry_wrapper(func, capability_id: str, dsh_plugin_id: Optional[str] = None):
    """自动遥测包装器 — 包裹任意能力调用，自动回传 success/latency_ms 到 CCP（S15：标记 DSH 来源）。"""
    start = time.time()
    try:
        result = func()
        latency = int((time.time() - start) * 1000)
        _client.telemetry(capability_id, True, latency, "dsh", dsh_plugin_id)
        return result
    except Exception as e:
        latency = int((time.time() - start) * 1000)
        _client.telemetry(capability_id, False, latency, "dsh", dsh_plugin_id)
        raise e


def telemetry_async_wrapper(func, capability_id: str, dsh_plugin_id: Optional[str] = None):
    """异步遥测包装器 — 包裹异步能力调用，自动回传遥测到 CCP（S15：标记 DSH 来源）。"""
    async def _wrap():
        start = time.time()
        try:
            result = await func
            latency = int((time.time() - start) * 1000)
            _client.telemetry(capability_id, True, latency, "dsh", dsh_plugin_id)
            return result
        except Exception as e:
            latency = int((time.time() - start) * 1000)
            _client.telemetry(capability_id, False, latency, "dsh", dsh_plugin_id)
            raise e
    return _wrap()