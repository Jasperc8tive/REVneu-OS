import os
from typing import Any

import httpx
from pydantic import BaseModel, ConfigDict, Field, ValidationError

from agents.base_agent import AgentFinding


class LlmUsage(BaseModel):
    model_config = ConfigDict(extra='forbid')

    tokens_used: int = Field(ge=0)
    token_cost_usd: float = Field(ge=0)


class StructuredLlmResponse(BaseModel):
    model_config = ConfigDict(extra='forbid')

    summary: str
    findings: list[AgentFinding]
    usage: LlmUsage


class LlmProxyClient:
    def __init__(self) -> None:
        self.url = os.getenv('LLM_PROXY_URL', '').rstrip('/')
        self.api_key = os.getenv('LLM_PROXY_API_KEY')
        self.primary_model = os.getenv('LLM_PRIMARY_MODEL', 'gpt-4o')
        self.fallback_model = os.getenv('LLM_FALLBACK_MODEL', 'claude-3-5-sonnet')
        self.timeout_s = max(2.0, float(os.getenv('LLM_PROXY_TIMEOUT_S', '15')))

    @property
    def enabled(self) -> bool:
        return len(self.url) > 0

    def _headers(self) -> dict[str, str]:
        headers = {'Content-Type': 'application/json'}
        if self.api_key:
            headers['Authorization'] = f'Bearer {self.api_key}'
        return headers

    async def _post(self, model: str, payload: dict[str, Any]) -> StructuredLlmResponse:
        request_body = {
            'model': model,
            'mode': 'json_schema',
            'tenant_id': payload['tenant_id'],
            'agent_id': payload['agent_id'],
            'period': payload['period'],
            'system_context': payload['system_context'],
            'input': payload['input'],
            'output_schema': StructuredLlmResponse.model_json_schema(),
        }

        async with httpx.AsyncClient(timeout=self.timeout_s) as client:
            response = await client.post(
                f'{self.url}/v1/agent-analysis',
                headers=self._headers(),
                json=request_body,
            )
            response.raise_for_status()
            data = response.json()

        # Allow either direct object or wrapped object from proxy adapters.
        candidate = data.get('result') if isinstance(data, dict) and 'result' in data else data
        if not isinstance(candidate, dict):
            raise ValueError('LLM proxy returned non-object payload')

        try:
            return StructuredLlmResponse.model_validate(candidate)
        except ValidationError as exc:
            raise ValueError(f'LLM response failed strict schema validation: {exc}') from exc

    async def analyze(self, payload: dict[str, Any]) -> StructuredLlmResponse | None:
        if not self.enabled:
            return None

        try:
            return await self._post(self.primary_model, payload)
        except Exception:
            # Fallback model for complex reasoning or provider-level failures.
            return await self._post(self.fallback_model, payload)
