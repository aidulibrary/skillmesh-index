"""
CCP Client — Python SDK for CCP Protocol v1.0.0

CCP（能力通约协议）的 Python 参考实现。与 JS SDK 功能对等。

功能：
- 能力发现：search / list / detail
- 适配器生成：为 5 个框架生成调用代码
- 遥测闭环：回传调用结果，维护信任向量
- 信任向量计算：computeWeightedScore 等算法
- 联邦支持：联邦搜索 + 节点信息

用法:
    from ccp_client import CCPClient

    client = CCPClient()
    results = client.search("pdf text extraction")
    detail = client.detail("pdf-extract-text-001")
    client.telemetry("pdf-extract-text-001", success=True)

版本：v1.0.0
协议：CCP v1.0.0
许可：MIT
"""

import math
from typing import Optional, Dict, Any, List

__version__ = "1.0.0"


def _normalize_endpoint(endpoint: str) -> str:
    """将端点 URL 规范化：非 ASCII 主机名转为 IDNA（punycode）编码。

    Python urllib 不支持含非 ASCII 字符的 hostname（会抛 latin-1 编码错误），
    需在发起请求前把中文域名转换为 punycode 形式（如 礼字号.中国 -> xn--...）。
    """
    import urllib.parse

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


# ========== 信任向量算法（v1.0.0 冻结） ==========

def compute_usage_rate(usage: int) -> float:
    """计算使用痕迹率（归一化至 0-1）

    公式: min(1, log10(max(usage, 1)) / 5)
    1 次调用 → 0, 10 次 → 0.2, 100 次 → 0.4, 1000 次 → 0.6, 100000 次 → 1.0
    """
    return min(1.0, math.log10(max(usage, 1)) / 5.0)


def compute_success(old_success: float, old_evidence: int, success: bool) -> float:
    """计算成功率（滚动平均）

    公式: newSuccess = (oldSuccess * oldEvidence + newSuccessValue) / (oldEvidence + 1)
    """
    if old_evidence > 0:
        return (old_success * old_evidence + (1.0 if success else 0.0)) / (old_evidence + 1)
    return 1.0 if success else 0.5


def compute_uncertainty(evidence_count: int) -> float:
    """计算不确定性（基于 Josang 主观逻辑）

    公式: u = 1 / (1 + log10(max(count, 1)))
    0 次证据 → 1.0, 10 次 → 0.5, 100 次 → 0.33, 1000 次 → 0.25
    """
    return 1.0 / (1.0 + math.log10(max(evidence_count, 1)))


def compute_time_score(old_time: float) -> float:
    """计算时效性（衰减函数）

    公式: newTime = min(1, oldTime * 0.95 + 0.05)
    """
    return min(1.0, (old_time or 0.5) * 0.95 + 0.05)


def compute_weighted_score(
    trust: Dict[str, Any],
    uncertainty: float,
    weights: Optional[Dict[str, float]] = None,
) -> float:
    """计算加权综合信任分

    默认权重（SPEC v1.0.0）: source=25%, usage=15%, success=30%, risk=15%, time=15%
    结果受不确定性惩罚: finalScore = weightedScore * (1 - uncertainty * 0.5)

    Args:
        trust: 信任向量字典，包含 trustSource/trustUsage/trustUsageRate/trustSuccess/trustRisk/trustTime
        uncertainty: 不确定性（0-1）
        weights: 可选权重配置

    Returns:
        0-1 之间的综合信任分
    """
    if weights is None:
        weights = {}

    w = {
        "source": weights.get("source", 0.25),
        "usage": weights.get("usage", 0.15),
        "success": weights.get("success", 0.30),
        "risk": weights.get("risk", 0.15),
        "time": weights.get("time", 0.15),
    }

    usage_rate = trust.get("trustUsageRate") or compute_usage_rate(trust.get("trustUsage", 0))

    weighted = (
        w["source"] * (trust.get("trustSource", 0) or 0)
        + w["usage"] * usage_rate
        + w["success"] * (trust.get("trustSuccess", 0) or 0)
        + w["risk"] * (1.0 - (trust.get("trustRisk", 0) or 0))
        + w["time"] * (trust.get("trustTime", 0) or 0)
    )

    return weighted * (1.0 - (uncertainty if uncertainty is not None else 0.5) * 0.5)


# ========== CCP API 客户端 ==========

class CCPClient:
    """CCP API HTTP 客户端

    Args:
        endpoint: CCP API 端点 URL（默认使用 SkillMesh 主节点）
        timeout: 请求超时秒数（默认 10）
    """

    DEFAULT_ENDPOINT = "https://skillmesh.礼字号.中国/api/ccp/v1"

    def __init__(self, endpoint: Optional[str] = None, timeout: int = 10):
        import urllib.request
        import urllib.error

        self.endpoint = _normalize_endpoint(endpoint or self.DEFAULT_ENDPOINT).rstrip("/")
        self.timeout = timeout

    def _request(
        self,
        path: str,
        method: str = "GET",
        body: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """发送 HTTP 请求"""
        import urllib.request
        import urllib.error
        import json

        url = f"{self.endpoint}{path}"
        data = json.dumps(body).encode("utf-8") if body else None

        req = urllib.request.Request(
            url,
            data=data,
            headers={
                "Content-Type": "application/json",
                "Accept": "application/json",
                "User-Agent": f"ccp-client-python/{__version__}",
            },
            method=method,
        )

        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            return {
                "error": {
                    "code": "HTTP_ERROR",
                    "message": str(e),
                    "status": e.code,
                }
            }
        except Exception as e:
            return {
                "error": {
                    "code": "NETWORK_ERROR",
                    "message": str(e),
                }
            }

    def search(
        self,
        q: str,
        category: Optional[str] = None,
        federated: bool = False,
    ) -> Dict[str, Any]:
        """搜索能力锚点

        Args:
            q: 搜索关键词（中文或英文）
            category: 能力分类过滤（ai/data/media/language/dev）
            federated: 是否启用联邦搜索

        Returns:
            包含 results 列表和 count 的字典
        """
        import urllib.parse

        params = f"?q={urllib.parse.quote(q)}"
        if category:
            params += f"&category={urllib.parse.quote(category)}"
        if federated:
            params += "&federated=true"
        return self._request(f"/search{params}")

    def detail(self, capability_id: str) -> Dict[str, Any]:
        """获取能力锚点详情

        Args:
            capability_id: 能力锚点 ID（如 pdf-extract-text-001）

        Returns:
            完整的能力锚点对象
        """
        import urllib.parse

        return self._request(
            f"/capabilities/{urllib.parse.quote(capability_id)}"
        )

    def list_capabilities(
        self, category: Optional[str] = None
    ) -> Dict[str, Any]:
        """列出所有能力锚点

        Args:
            category: 能力分类过滤

        Returns:
            包含 capabilities 列表的字典
        """
        params = ""
        if category:
            import urllib.parse
            params = f"?category={urllib.parse.quote(category)}"
        return self._request(f"/capabilities{params}")

    def adapter(
        self, capability_id: str, framework: str = "dsh"
    ) -> Dict[str, Any]:
        """生成适配器代码（服务端返回 YAML 文本）

        Args:
            capability_id: 能力锚点 ID
            framework: 目标框架（dsh/mcp/langchain/crewai/dify）

        Returns:
            包含适配器 YAML 文本的字典：{"adapter": "...", "framework": "..."}
        """
        import urllib.request
        import urllib.error
        import urllib.parse

        url = (
            f"{self.endpoint}/capabilities/{urllib.parse.quote(capability_id)}"
            f"/adapters/{urllib.parse.quote(framework)}"
        )
        req = urllib.request.Request(
            url,
            headers={
                "Accept": "text/yaml,text/plain,*/*",
                "User-Agent": f"ccp-client-python/{__version__}",
            },
            method="GET",
        )
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                return {"adapter": resp.read().decode("utf-8"), "framework": framework}
        except urllib.error.HTTPError as e:
            return {
                "error": {
                    "code": "HTTP_ERROR",
                    "message": str(e),
                    "status": e.code,
                }
            }
        except Exception as e:
            return {
                "error": {
                    "code": "NETWORK_ERROR",
                    "message": str(e),
                }
            }

    def telemetry(
        self,
        capability_id: str,
        success: bool,
        latency_ms: int = 0,
    ) -> Dict[str, Any]:
        """回传调用结果到遥测端点

        Args:
            capability_id: 能力锚点 ID
            success: 调用是否成功
            latency_ms: 调用延迟（毫秒）

        Returns:
            确认信息
        """
        return self._request(
            "/telemetry",
            method="POST",
            body={
                "capability_id": capability_id,
                "success": success,
                "latency_ms": latency_ms,
                "agent_id": "ccp-client-python",
            },
        )

    def node_info(self) -> Dict[str, Any]:
        """获取节点信息"""
        return self._request("/node")

    def contribute(self, capability: Dict[str, Any]) -> Dict[str, Any]:
        """贡献新的能力锚点

        Args:
            capability: 能力锚点对象（需符合 CCP Schema）

        Returns:
            确认信息
        """
        return self._request(
            "/contribute",
            method="POST",
            body=capability,
        )


# ========== 便捷函数 ==========

def search(
    q: str,
    endpoint: Optional[str] = None,
    category: Optional[str] = None,
    federated: bool = False,
) -> Dict[str, Any]:
    """搜索能力锚点（便捷函数）"""
    client = CCPClient(endpoint=endpoint)
    return client.search(q, category=category, federated=federated)


def detail(
    capability_id: str, endpoint: Optional[str] = None
) -> Dict[str, Any]:
    """获取能力锚点详情（便捷函数）"""
    client = CCPClient(endpoint=endpoint)
    return client.detail(capability_id)


def get_trust_summary(capability: Dict[str, Any]) -> Dict[str, Any]:
    """从能力锚点中提取信任向量摘要

    Args:
        capability: 能力锚点对象

    Returns:
        信任向量摘要，包含五维 + 证据层 + 综合评分
    """
    trust = {
        "source": capability.get("trustSource"),
        "usage": capability.get("trustUsage", 0),
        "usage_rate": capability.get("trustUsageRate"),
        "success": capability.get("trustSuccess"),
        "risk": capability.get("trustRisk"),
        "time": capability.get("trustTime"),
    }

    evidence = capability.get("evidence", {})
    uncertainty = evidence.get("uncertainty") or compute_uncertainty(
        evidence.get("count", 0)
    )
    weighted = compute_weighted_score(trust, uncertainty)

    return {
        "dimensions": trust,
        "evidence": {
            "count": evidence.get("count", 0),
            "uncertainty": uncertainty,
        },
        "weighted_score": weighted,
        "verdict": (
            "highly_trusted"
            if weighted > 0.8
            else "trusted"
            if weighted > 0.6
            else "uncertain"
            if weighted > 0.4
            else "low_trust"
        ),
    }