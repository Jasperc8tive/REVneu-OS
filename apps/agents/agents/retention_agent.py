from typing import Any

from agents.base_agent import AgentFinding, BaseAgent


class CustomerRetentionAgent(BaseAgent):
    name = "customer_retention"
    description = "Score churn risk and recommend retention actions."

    async def fetch_data(self, period: str) -> dict[str, Any]:
        return {
            "period": period,
            "high_risk_customers": 37,
            "payment_failures": 19,
            "active_customers": 860,
        }

    async def analyze(self, data: dict[str, Any]) -> list[AgentFinding]:
        risk_rate = data["high_risk_customers"] / max(data["active_customers"], 1)

        if risk_rate > 0.03:
            return [
                AgentFinding(
                    type="churn_risk_cluster",
                    severity="high",
                    insight=(
                        f"High-risk cohort is {risk_rate * 100:.1f}% of active customers with {data['payment_failures']} payment failures."
                    ),
                    recommendation="Launch win-back sequence and proactive billing retry outreach for at-risk segment.",
                    expected_impact="Reduce near-term churn and recover failed payment revenue.",
                    data={"risk_rate": risk_rate, "payment_failures": data["payment_failures"]},
                )
            ]

        return [
            AgentFinding(
                type="retention_stable",
                severity="low",
                insight="Churn risk is within target threshold.",
                recommendation="Continue current retention workflows and monitor weekly.",
                expected_impact="Sustain baseline retention rate.",
            )
        ]
