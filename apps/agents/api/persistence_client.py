import os
from asyncio import sleep
from datetime import UTC, datetime
from logging import getLogger
from typing import Any

import httpx

from api.schemas import AgentRunLog, RecommendationRecord


class AgentPersistenceClient:
    def __init__(self) -> None:
        self.logger = getLogger(self.__class__.__name__)
        self.api_base_url = os.getenv("API_URL", "http://localhost:4000").rstrip("/")
        self.api_key = os.getenv("AGENT_API_KEY")
        mode = os.getenv("AGENT_PERSISTENCE_MODE", "auto").lower()
        self.max_retries = max(1, int(os.getenv("AGENT_PERSISTENCE_MAX_RETRIES", "3")))
        self.base_backoff_ms = max(100, int(os.getenv("AGENT_PERSISTENCE_BACKOFF_MS", "250")))

        self.metrics: dict[str, int] = {
            "persist_attempt_total": 0,
            "persist_success_total": 0,
            "persist_failure_total": 0,
            "dead_letter_total": 0,
        }
        self.dead_letters: list[dict[str, Any]] = []

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

    def telemetry_snapshot(self) -> dict[str, Any]:
        return {
            "enabled": self.enabled,
            "api_base_url": self.api_base_url,
            "max_retries": self.max_retries,
            "metrics": dict(self.metrics),
            "dead_letter_size": len(self.dead_letters),
        }

    def get_dead_letters(self) -> list[dict[str, Any]]:
        return list(self.dead_letters)

    async def _post_with_retry(self, url: str, payload: dict[str, Any], operation: str) -> bool:
        if not self.enabled:
            return False

        self.metrics["persist_attempt_total"] += 1
        last_error = ""

        for attempt in range(1, self.max_retries + 1):
            try:
                async with httpx.AsyncClient(timeout=3.0) as client:
                    response = await client.post(
                        url,
                        headers=self._headers(),
                        json=payload,
                    )
                    response.raise_for_status()
                    self.metrics["persist_success_total"] += 1
                    return True
            except Exception as exc:
                last_error = str(exc)
                self.metrics["persist_failure_total"] += 1
                if attempt < self.max_retries:
                    delay_s = (self.base_backoff_ms * (2 ** (attempt - 1))) / 1000
                    await sleep(delay_s)

        dead_letter = {
            "operation": operation,
            "url": url,
            "payload": payload,
            "error": last_error,
            "attempted_retries": self.max_retries,
            "created_at": datetime.now(UTC).isoformat(),
        }
        self.dead_letters.append(dead_letter)
        self.metrics["dead_letter_total"] += 1
        self.logger.error("Dead-lettered persistence event for %s: %s", operation, last_error)
        return False

    async def _get_with_retry(
        self,
        url: str,
        params: dict[str, Any],
        operation: str,
    ) -> list[dict[str, Any]] | None:
        if not self.enabled:
            return None

        self.metrics["persist_attempt_total"] += 1
        last_error = ""

        for attempt in range(1, self.max_retries + 1):
            try:
                async with httpx.AsyncClient(timeout=3.0) as client:
                    response = await client.get(
                        url,
                        headers=self._headers(),
                        params=params,
                    )
                    response.raise_for_status()
                    self.metrics["persist_success_total"] += 1
                    return response.json()
            except Exception as exc:
                last_error = str(exc)
                self.metrics["persist_failure_total"] += 1
                if attempt < self.max_retries:
                    delay_s = (self.base_backoff_ms * (2 ** (attempt - 1))) / 1000
                    await sleep(delay_s)

        dead_letter = {
            "operation": operation,
            "url": url,
            "params": params,
            "error": last_error,
            "attempted_retries": self.max_retries,
            "created_at": datetime.now(UTC).isoformat(),
        }
        self.dead_letters.append(dead_letter)
        self.metrics["dead_letter_total"] += 1
        self.logger.error("Dead-lettered persistence read for %s: %s", operation, last_error)
        return None

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
            "metadata": run.metadata or {"run_id": run.run_id},
        }

        return await self._post_with_retry(
            f"{self.api_base_url}/api/v1/agent-runs/internal",
            payload,
            operation="persist_run",
        )

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

        return await self._post_with_retry(
            f"{self.api_base_url}/api/v1/recommendations/internal",
            payload,
            operation="persist_recommendation",
        )

    async def list_runs(self, tenant_id: str, agent_id: str | None = None) -> list[AgentRunLog] | None:
        if not self.enabled:
            return None

        params: dict[str, Any] = {"organizationId": tenant_id}
        if agent_id:
            params["agentId"] = agent_id

        try:
            records = await self._get_with_retry(
                f"{self.api_base_url}/api/v1/agent-runs/internal",
                params,
                operation="list_runs",
            )
            if records is None:
                return None

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
                    metadata=item.get("metadata") or {},
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
            records = await self._get_with_retry(
                f"{self.api_base_url}/api/v1/recommendations/internal",
                params,
                operation="list_recommendations",
            )
            if records is None:
                return None

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
