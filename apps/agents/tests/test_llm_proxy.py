import pytest

from api.llm_proxy_client import LlmProxyClient


class _FakeResponse:
    def __init__(self, payload: dict):
        self._payload = payload

    def raise_for_status(self) -> None:
        return None

    def json(self) -> dict:
        return self._payload


class _FakeAsyncClient:
    def __init__(self, payload: dict):
        self._payload = payload

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return None

    async def post(self, url: str, headers: dict, json: dict):
        assert url.endswith('/v1/agent-analysis')
        assert json['mode'] == 'json_schema'
        return _FakeResponse(self._payload)


@pytest.mark.asyncio
async def test_llm_proxy_enforces_strict_schema(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv('LLM_PROXY_URL', 'http://proxy.local')

    # Invalid payload: extra field + missing usage fields should fail strict schema validation.
    invalid_payload = {
        'result': {
            'summary': 'ok',
            'findings': [
                {
                    'type': 'budget_waste',
                    'severity': 'high',
                    'insight': 'x',
                    'recommendation': 'y',
                    'unexpected': 'not-allowed',
                },
            ],
            'usage': {
                'tokens': 100,
            },
        },
    }

    monkeypatch.setattr(
        'api.llm_proxy_client.httpx.AsyncClient',
        lambda timeout: _FakeAsyncClient(invalid_payload),
    )

    client = LlmProxyClient()

    with pytest.raises(ValueError, match='strict schema validation'):
        await client.analyze(
            {
                'tenant_id': 'tenant-a',
                'agent_id': 'marketing_performance',
                'period': 'last_30_days',
                'system_context': {'market': 'nigeria'},
                'input': {'data': {}, 'candidate_findings': []},
            },
        )
