from typing import Any

from agents.base_agent import AgentFinding, BaseAgent


class PricingOptimizationAgent(BaseAgent):
    name = "pricing_optimization"
    description = "Estimate elasticity and identify better price points."

    async def fetch_data(self, period: str) -> dict[str, Any]:
        return {
            "period": period,
            "current_price": 25_000,
            "elasticity": -1.4,
            "margin_pct": 0.52,
        }

    async def analyze(self, data: dict[str, Any]) -> list[AgentFinding]:
        elasticity = data["elasticity"]
        if elasticity < -1.2:
            return [
                AgentFinding(
                    type="high_price_sensitivity",
                    severity="medium",
                    insight="Demand is price-sensitive; current plan likely leaves revenue on the table.",
                    recommendation="Test a 5% price reduction on one segment for 14 days and compare net revenue uplift.",
                    expected_impact="Improve conversion while preserving healthy unit margin.",
                    data={"elasticity": elasticity, "margin_pct": data["margin_pct"]},
                )
            ]

        return [
            AgentFinding(
                type="pricing_stable",
                severity="low",
                insight="Current pricing appears close to optimal for demand profile.",
                recommendation="Maintain pricing and run quarterly elasticity reassessment.",
                expected_impact="Preserve predictable monetization.",
            )
        ]
