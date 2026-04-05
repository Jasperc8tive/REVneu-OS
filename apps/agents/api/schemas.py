from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class RunAgentRequest(BaseModel):
    agent_id: str
    tenant_id: str
    period: str = "last_30_days"


class RunAllAgentsRequest(BaseModel):
    tenant_id: str
    period: str = "last_30_days"


class AgentRunLog(BaseModel):
    run_id: str
    tenant_id: str
    agent_id: str
    period: str
    status: str
    started_at: datetime
    finished_at: datetime | None = None
    duration_ms: int | None = None
    tokens_used: int = 0
    token_cost_usd: float = 0.0
    error: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class RecommendationRecord(BaseModel):
    tenant_id: str
    agent_id: str
    run_id: str
    generated_at: datetime
    findings: list[dict[str, Any]] = Field(default_factory=list)
    summary: str | None = None


class AgentCheckpoint(BaseModel):
    run_id: str
    tenant_id: str
    agent_id: str
    period: str
    stage: str
    created_at: datetime
    payload: dict[str, Any] = Field(default_factory=dict)
