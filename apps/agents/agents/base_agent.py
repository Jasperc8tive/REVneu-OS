"""
Base agent class — all 7 Revneu OS agents extend this.

Architecture:
  fetch_data() → analyze() → run() → AgentOutput
"""

import uuid
from abc import ABC, abstractmethod
from datetime import UTC, datetime
from typing import Any

from pydantic import BaseModel, Field


class AgentFinding(BaseModel):
    """A single finding from an agent analysis run."""

    type: str
    severity: str  # "low" | "medium" | "high" | "critical"
    insight: str
    recommendation: str
    expected_impact: str | None = None
    data: dict[str, Any] | None = None


class AgentOutput(BaseModel):
    """Full structured output from an agent run."""

    agent: str
    tenant_id: str
    period: str
    run_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    findings: list[AgentFinding]
    summary: str | None = None
    generated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    tokens_used: int | None = None
    error: str | None = None


class BaseAgent(ABC):
    """
    Abstract base for all Revneu OS growth agents.

    Each agent must implement:
      - fetch_data(period) — pull tenant metrics from the data store
      - analyze(data)     — transform raw data into AgentFindings
    """

    name: str
    description: str

    def __init__(self, tenant_id: str) -> None:
        self.tenant_id = tenant_id

    @abstractmethod
    async def fetch_data(self, period: str) -> dict[str, Any]:
        """Fetch required metrics for this agent from the data store."""

    @abstractmethod
    async def analyze(self, data: dict[str, Any]) -> list[AgentFinding]:
        """Run analysis on fetched data and return structured findings."""

    async def run(self, period: str = "last_30_days") -> AgentOutput:
        """Execute the full agent pipeline: fetch → analyze → output."""
        data = await self.fetch_data(period)
        findings = await self.analyze(data)

        return AgentOutput(
            agent=self.name,
            tenant_id=self.tenant_id,
            period=period,
            findings=findings,
        )
