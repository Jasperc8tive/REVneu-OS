import asyncio

import pytest
from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


def test_register():
    """Auth routes are not part of the Stage 3 agent service surface yet."""
    response = client.post(
        "/api/v1/auth/register",
        json={
            "email": "test@example.com",
            "password": "password123",
            "name": "Test User",
            "organizationName": "Test Org",
            "organizationSlug": "test-org",
        },
    )
    assert response.status_code == 404


def test_login():
    """Auth routes are not part of the Stage 3 agent service surface yet."""
    response = client.post(
        "/api/v1/auth/login",
        json={
            "email": "test@example.com",
            "password": "password123",
        },
    )
    assert response.status_code == 404


def test_refresh_token():
    """Auth routes are not part of the Stage 3 agent service surface yet."""
    response = client.post(
        "/api/v1/auth/refresh",
        json={"refreshToken": "invalid_token_for_testing"},
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_concurrent_registrations():
    """Concurrent auth registration is not exposed by the Stage 3 agent service."""
    tasks = [
        asyncio.create_task(
            asyncio.to_thread(
                client.post,
                "/api/v1/auth/register",
                json={
                    "email": f"concurrent{i}@example.com",
                    "password": "password123",
                    "name": f"User {i}",
                    "organizationName": f"Org {i}",
                    "organizationSlug": f"org-{i}",
                },
            )
        )
        for i in range(3)
    ]

    responses = await asyncio.gather(*tasks)
    assert all(r.status_code == 404 for r in responses)
