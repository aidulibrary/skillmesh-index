"""
CCP 能力通约协议 — Dify 插件 Provider
========================================
提供 CCP 联邦网络的能力搜索、详情查询、适配器获取功能。
"""

from typing import Any
from dify_plugin import ToolProvider
from dify_plugin.errors.tool import ToolProviderCredentialValidationError
import requests
import json


class CcpProvider(ToolProvider):
    BASE_URL = "https://skillmesh.礼字号.中国/api/ccp/v1"

    def _validate_credentials(self, credentials: dict[str, Any]) -> None:
        try:
            resp = requests.get(f"{self.BASE_URL}/health", timeout=10)
            resp.raise_for_status()
        except Exception as e:
            raise ToolProviderCredentialValidationError(
                f"CCP service unreachable: {e}"
            )

    def search(self, query: str, federated: bool = False) -> dict:
        params = {"q": query}
        if federated:
            params["federated"] = "true"
        resp = requests.get(f"{self.BASE_URL}/search", params=params, timeout=15)
        resp.raise_for_status()
        return resp.json()

    def get_capability(self, capability_id: str) -> dict:
        resp = requests.get(
            f"{self.BASE_URL}/capabilities/{capability_id}", timeout=15
        )
        resp.raise_for_status()
        return resp.json()

    def get_adapter(self, capability_id: str, framework: str = "langchain") -> dict:
        resp = requests.get(
            f"{self.BASE_URL}/capabilities/{capability_id}/adapters/{framework}",
            timeout=15,
        )
        resp.raise_for_status()
        return resp.json()