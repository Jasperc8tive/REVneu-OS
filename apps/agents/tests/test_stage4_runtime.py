"""Stage 4 runtime tests for triggering and inspecting AI agent runs."""

import pytest
from httpx import ASGITransport, AsyncClient

from main import app

TEST_AGENT_KEY = "stage4-test-agent-key-1234567890"


@pytest.fixture(autouse=True)
def set_agent_key_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("AGENT_API_KEY", TEST_AGENT_KEY)


@pytest.mark.asyncio
async def test_run_single_agent_and_validate_schema() -> None:
    payload = {
        "agent_id": "marketing_performance",
        "tenant_id": "tenant_stage4",
        "period": "last_30_days",
    }

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            "/api/v1/agents/run",
            json=payload,
            headers={"x-agent-api-key": TEST_AGENT_KEY},
        )

    assert response.status_code == 200
    data = response.json()
    assert data["agent"] == "marketing_performance"
    assert data["tenant_id"] == "tenant_stage4"
    assert isinstance(data["run_id"], str)
    assert isinstance(data["findings"], list)
    assert len(data["findings"]) >= 1


@pytest.mark.asyncio
async def test_run_all_agents_and_collect_recommendations() -> None:
    payload = {
        "tenant_id": "tenant_stage4_all",
        "period": "last_30_days",
    }

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        run_all_response = await client.post(
            "/api/v1/agents/run-all",
            json=payload,
            headers={"x-agent-api-key": TEST_AGENT_KEY},
        )
        assert run_all_response.status_code == 200
        run_all_data = run_all_response.json()
        assert run_all_data["count"] == 7

        runs_response = await client.get(
            "/api/v1/agents/runs",
            params={"tenant_id": "tenant_stage4_all"},
            headers={"x-agent-api-key": TEST_AGENT_KEY},
        )
        assert runs_response.status_code == 200
        runs_data = runs_response.json()
        assert runs_data["count"] >= 7

        recs_response = await client.get(
            "/api/v1/agents/recommendations",
            params={"tenant_id": "tenant_stage4_all"},
            headers={"x-agent-api-key": TEST_AGENT_KEY},
        )
        assert recs_response.status_code == 200
        recs_data = recs_response.json()
        assert recs_data["count"] >= 7


@pytest.mark.asyncio
async def test_unknown_agent_returns_404() -> None:
    payload = {
        "agent_id": "does_not_exist",
        "tenant_id": "tenant_stage4",
        "period": "last_30_days",
    }

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            "/api/v1/agents/run",
            json=payload,
            headers={"x-agent-api-key": TEST_AGENT_KEY},
        )

    assert response.status_code == 404


@pytest.mark.asyncio
async def test_missing_internal_key_returns_401() -> None:
    payload = {
        "agent_id": "marketing_performance",
        "tenant_id": "tenant_stage4",
        "period": "last_30_days",
    }

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post("/api/v1/agents/run", json=payload)

    assert response.status_code == 401
