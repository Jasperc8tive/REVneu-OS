import os

from fastapi import APIRouter, Header, HTTPException, Query

from api.agent_runtime import AgentRuntime
from api.schemas import RunAgentRequest, RunAllAgentsRequest

router = APIRouter()
runtime = AgentRuntime()


def require_internal_agent_key(x_agent_api_key: str | None) -> None:
    expected_key = os.getenv("AGENT_API_KEY")
    if not expected_key:
        raise HTTPException(status_code=401, detail="AGENT_API_KEY is not configured")

    if len(expected_key.strip()) < 24 or "change-me" in expected_key.lower():
        raise HTTPException(status_code=401, detail="AGENT_API_KEY is insecure")

    if not x_agent_api_key or x_agent_api_key != expected_key:
        raise HTTPException(status_code=401, detail="Invalid internal agent API key")

AGENT_REGISTRY = [
    {"id": "marketing_performance", "name": "Marketing Performance Agent", "stage": "4"},
    {"id": "customer_acquisition", "name": "Customer Acquisition Insights Agent", "stage": "4"},
    {"id": "sales_pipeline", "name": "Sales Pipeline Intelligence Agent", "stage": "4"},
    {"id": "revenue_forecasting", "name": "Revenue Forecasting Agent", "stage": "4"},
    {"id": "pricing_optimization", "name": "Pricing Optimization Agent", "stage": "4"},
    {"id": "customer_retention", "name": "Customer Retention Agent", "stage": "4"},
    {"id": "growth_opportunity", "name": "Growth Opportunity Agent", "stage": "4"},
]


@router.get("/agents")
async def list_agents() -> dict:
    registry = runtime.agent_registry()
    return {
        "total": len(registry),
        "agents": AGENT_REGISTRY,
    }


@router.get("/agents/health")
async def agents_health() -> dict:
    return {
        "status": "ok",
        "agents_registered": len(runtime.agent_registry()),
        "agents_active": len(runtime.agent_registry()),
        "note": "Stage 4 runtime is active",
    }


@router.post("/agents/run")
async def run_agent(
    request: RunAgentRequest,
    x_agent_api_key: str | None = Header(default=None),
) -> dict:
    require_internal_agent_key(x_agent_api_key)

    output = await runtime.run_agent(
        agent_id=request.agent_id,
        tenant_id=request.tenant_id,
        period=request.period,
    )
    return output.model_dump(mode="json")


@router.post("/agents/run-all")
async def run_all_agents(
    request: RunAllAgentsRequest,
    x_agent_api_key: str | None = Header(default=None),
) -> dict:
    require_internal_agent_key(x_agent_api_key)

    outputs = await runtime.run_all_agents(
        tenant_id=request.tenant_id,
        period=request.period,
    )
    return {
        "tenant_id": request.tenant_id,
        "period": request.period,
        "count": len(outputs),
        "results": [output.model_dump(mode="json") for output in outputs],
    }


@router.get("/agents/runs")
async def list_agent_runs(
    tenant_id: str = Query(..., min_length=3),
    x_agent_api_key: str | None = Header(default=None),
) -> dict:
    require_internal_agent_key(x_agent_api_key)

    runs = await runtime.list_runs(tenant_id=tenant_id)
    return {
        "tenant_id": tenant_id,
        "count": len(runs),
        "runs": [run.model_dump(mode="json") for run in runs],
    }


@router.get("/agents/recommendations")
async def list_recommendations(
    tenant_id: str = Query(..., min_length=3),
    agent_id: str | None = Query(None),
    x_agent_api_key: str | None = Header(default=None),
) -> dict:
    require_internal_agent_key(x_agent_api_key)

    recommendations = await runtime.list_recommendations(tenant_id=tenant_id, agent_id=agent_id)
    return {
        "tenant_id": tenant_id,
        "agent_id": agent_id,
        "count": len(recommendations),
        "recommendations": [item.model_dump(mode="json") for item in recommendations],
    }


@router.get("/agents/persistence/health")
async def persistence_health(x_agent_api_key: str | None = Header(default=None)) -> dict:
    require_internal_agent_key(x_agent_api_key)
    return runtime.get_persistence_telemetry()


@router.get("/agents/persistence/dead-letter")
async def persistence_dead_letter(x_agent_api_key: str | None = Header(default=None)) -> dict:
    require_internal_agent_key(x_agent_api_key)
    return {
        "dead_letters": runtime.get_persistence_dead_letters(),
    }
