"""
Agent service API routes.
Full agent endpoints are wired in Stage 4.
"""

from fastapi import APIRouter

router = APIRouter()

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
    return {
        "total": len(AGENT_REGISTRY),
        "agents": AGENT_REGISTRY,
    }


@router.get("/agents/health")
async def agents_health() -> dict:
    return {
        "status": "ok",
        "agents_registered": len(AGENT_REGISTRY),
        "agents_active": 0,
        "note": "Agents activated in Stage 4",
    }
