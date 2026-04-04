from typing import Any

from agents.base_agent import AgentFinding, BaseAgent


class GrowthOpportunityAgent(BaseAgent):
    name = "growth_opportunity"
    description = "Surface high-confidence opportunities across segments and products."

    async def fetch_data(self, period: str) -> dict[str, Any]:
        return {
            "period": period,
            "segments": [
                {"segment": "lagos_smb", "growth_rate": 0.22, "current_revenue_ngn": 3_200_000},
                {"segment": "abuja_enterprise", "growth_rate": 0.09, "current_revenue_ngn": 2_800_000},
            ],
        }

    async def analyze(self, data: dict[str, Any]) -> list[AgentFinding]:
        best_segment = max(data["segments"], key=lambda item: item["growth_rate"])

        return [
            AgentFinding(
                type="segment_expansion",
                severity="medium",
                insight=(
                    f"{best_segment['segment']} is growing at {best_segment['growth_rate'] * 100:.1f}% and shows strongest momentum."
                ),
                recommendation=(
                    f"Allocate additional demand generation budget to {best_segment['segment']} and launch targeted upsell offers."
                ),
                expected_impact="Capture incremental revenue from fastest-growing segment.",
                data=best_segment,
            )
        ]
