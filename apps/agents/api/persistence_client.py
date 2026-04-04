import os
from typing import Any

import httpx

from api.schemas import AgentRunLog, RecommendationRecord


class AgentPersistenceClient:
    def __init__(self) -> None:
        self.api_base_url = os.getenv("API_URL", "http://localhost:4000").rstrip("/")
        self.api_key = os.getenv("AGENT_API_KEY")
        mode = os.getenv("AGENT_PERSISTENCE_MODE", "auto").lower()

        if mode == "memory":
            self.enabled = False
        elif mode == "api":
            self.enabled = True
        else:
            self.enabled = bool(self.api_key)

    def _headers(self) -> dict[str, str]:
        return {
            "x-agent-api-key": self.api_key or "",
            "Content-Type": "application/json",
        }

    async def persist_run(self, run: AgentRunLog) -> bool:
        if not self.enabled:
            return False

        payload = {
            "id": run.run_id,
            "organizationId": run.tenant_id,
            "agentId": run.agent_id,
            "period": run.period,
            "status": run.status.upper(),
            "startedAt": run.started_at.isoformat(),
            "finishedAt": run.finished_at.isoformat() if run.finished_at else None,
            "durationMs": run.duration_ms,
            "tokensUsed": run.tokens_used,
            "tokenCostUsd": run.token_cost_usd,
            "error": run.error,
            "metadata": {"run_id": run.run_id},
        }

        try:
            async with httpx.AsyncClient(timeout=3.0) as client:
                response = await client.post(
                    f"{self.api_base_url}/api/v1/agent-runs/internal",
                    headers=self._headers(),
                    json=payload,
                )
                response.raise_for_status()
                return True
        except Exception:
            return False

    async def persist_recommendation(self, recommendation: RecommendationRecord) -> bool:
        if not self.enabled:
            return False

        payload = {
            "organizationId": recommendation.tenant_id,
            "agentRunId": recommendation.run_id,
            "agentId": recommendation.agent_id,
            "summary": recommendation.summary,
            "findings": recommendation.findings,
        }

        try:
            async with httpx.AsyncClient(timeout=3.0) as client:
                response = await client.post(
                    f"{self.api_base_url}/api/v1/recommendations/internal",
                    headers=self._headers(),
                    json=payload,
                )
                response.raise_for_status()
                return True
        except Exception:
            return False

    async def list_runs(self, tenant_id: str, agent_id: str | None = None) -> list[AgentRunLog] | None:
        if not self.enabled:
            return None

        params: dict[str, Any] = {"organizationId": tenant_id}
        if agent_id:
            params["agentId"] = agent_id

        try:
            async with httpx.AsyncClient(timeout=3.0) as client:
                response = await client.get(
                    f"{self.api_base_url}/api/v1/agent-runs/internal",
                    headers=self._headers(),
                    params=params,
                )
                response.raise_for_status()
                records = response.json()

                return [
                    AgentRunLog(
                        run_id=item["id"],
                        tenant_id=item["organizationId"],
                        agent_id=item["agentId"],
                        period=item["period"],
                        status=item["status"].lower(),
                        started_at=item["startedAt"],
                        finished_at=item.get("finishedAt"),
                        duration_ms=item.get("durationMs"),
                        tokens_used=item.get("tokensUsed", 0),
                        token_cost_usd=float(item.get("tokenCostUsd", 0.0)),
                        error=item.get("error"),
                    )
                    for item in records
                ]
        except Exception:
            return None

    async def list_recommendations(
        self,
        tenant_id: str,
        agent_id: str | None = None,
    ) -> list[RecommendationRecord] | None:
        if not self.enabled:
            return None

        params: dict[str, Any] = {"organizationId": tenant_id}
        if agent_id:
            params["agentId"] = agent_id

        try:
            async with httpx.AsyncClient(timeout=3.0) as client:
                response = await client.get(
                    f"{self.api_base_url}/api/v1/recommendations/internal",
                    headers=self._headers(),
                    params=params,
                )
                response.raise_for_status()
                records = response.json()

                return [
                    RecommendationRecord(
                        tenant_id=item["organizationId"],
                        agent_id=item["agentId"],
                        run_id=item["agentRunId"],
                        generated_at=item["createdAt"],
                        findings=item.get("findings", []),
                        summary=item.get("summary"),
                    )
                    for item in records
                ]
        except Exception:
            return None
