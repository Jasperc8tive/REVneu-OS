from fastapi import APIRouter, Query

from api.agent_runtime import AgentRuntime
from api.schemas import RunAgentRequest, RunAllAgentsRequest

router = APIRouter()
runtime = AgentRuntime()

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
async def run_agent(request: RunAgentRequest) -> dict:
    output = await runtime.run_agent(
        agent_id=request.agent_id,
        tenant_id=request.tenant_id,
        period=request.period,
    )
    return output.model_dump(mode="json")


@router.post("/agents/run-all")
async def run_all_agents(request: RunAllAgentsRequest) -> dict:
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
async def list_agent_runs(tenant_id: str = Query(..., min_length=3)) -> dict:
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
) -> dict:
    recommendations = await runtime.list_recommendations(tenant_id=tenant_id, agent_id=agent_id)
    return {
        "tenant_id": tenant_id,
        "agent_id": agent_id,
        "count": len(recommendations),
        "recommendations": [item.model_dump(mode="json") for item in recommendations],
    }
