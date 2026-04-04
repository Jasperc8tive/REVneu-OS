from typing import Any

from agents.base_agent import AgentFinding, BaseAgent


class SalesPipelineIntelligenceAgent(BaseAgent):
    name = "sales_pipeline"
    description = "Detect pipeline bottlenecks and at-risk deals."

    async def fetch_data(self, period: str) -> dict[str, Any]:
        return {
            "period": period,
            "stages": [
                {"stage": "qualification", "deals": 120, "avg_days": 6},
                {"stage": "proposal", "deals": 68, "avg_days": 14},
                {"stage": "negotiation", "deals": 31, "avg_days": 22},
            ],
        }

    async def analyze(self, data: dict[str, Any]) -> list[AgentFinding]:
        findings: list[AgentFinding] = []

        for stage in data["stages"]:
            if stage["avg_days"] > 18:
                findings.append(
                    AgentFinding(
                        type="deal_stall_risk",
                        severity="high",
                        insight=(
                            f"{stage['stage']} stage average age is {stage['avg_days']} days, indicating a close-risk bottleneck."
                        ),
                        recommendation=(
                            f"Escalate aging opportunities in {stage['stage']} with a 48-hour rep follow-up SLA."
                        ),
                        expected_impact="Increase stage velocity and improve close rates.",
                        data={"stage": stage["stage"], "avg_days": stage["avg_days"]},
                    )
                )

        if not findings:
            findings.append(
                AgentFinding(
                    type="pipeline_stable",
                    severity="low",
                    insight="Pipeline velocity is within expected thresholds.",
                    recommendation="Maintain current rep cadence and monitor weekly stage aging.",
                    expected_impact="Sustain predictable deal flow.",
                )
            )

        return findings
