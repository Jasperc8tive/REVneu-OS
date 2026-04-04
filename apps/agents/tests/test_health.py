"""Tests for agent service health endpoints."""

import pytest
from httpx import ASGITransport, AsyncClient

from main import app


@pytest.mark.asyncio
async def test_health_endpoint() -> None:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["service"] == "revneu-agents"


@pytest.mark.asyncio
async def test_list_agents() -> None:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/v1/agents")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 7
    assert len(data["agents"]) == 7
