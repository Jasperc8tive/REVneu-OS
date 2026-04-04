from typing import Any

from agents.base_agent import AgentFinding, BaseAgent


class CustomerAcquisitionInsightsAgent(BaseAgent):
    name = "customer_acquisition"
    description = "Identify highest-value acquisition channels and funnel leaks."

    async def fetch_data(self, period: str) -> dict[str, Any]:
        return {
            "period": period,
            "sources": [
                {"source": "organic", "sessions": 8200, "leads": 510, "revenue_ngn": 6_500_000},
                {"source": "meta_ads", "sessions": 4300, "leads": 290, "revenue_ngn": 3_600_000},
                {"source": "google_ads", "sessions": 3800, "leads": 170, "revenue_ngn": 2_400_000},
            ],
        }

    async def analyze(self, data: dict[str, Any]) -> list[AgentFinding]:
        findings: list[AgentFinding] = []

        for source in data["sources"]:
            lead_rate = source["leads"] / max(source["sessions"], 1)
            if lead_rate < 0.05:
                findings.append(
                    AgentFinding(
                        type="funnel_leak",
                        severity="medium",
                        insight=(
                            f"{source['source']} lead conversion is {lead_rate * 100:.1f}% which is below 5% benchmark."
                        ),
                        recommendation=(
                            f"Revise landing page and offer for {source['source']} traffic to improve lead capture."
                        ),
                        expected_impact="Improve qualified lead volume by 10-20%.",
                        data={"source": source["source"], "lead_rate": lead_rate},
                    )
                )

        if not findings:
            findings.append(
                AgentFinding(
                    type="acquisition_healthy",
                    severity="low",
                    insight="Acquisition funnel is stable across active channels.",
                    recommendation="Continue current source mix with weekly cohort monitoring.",
                    expected_impact="Maintain predictable lead growth.",
                )
            )

        return findings
