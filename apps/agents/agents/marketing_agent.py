from typing import Any

from agents.base_agent import AgentFinding, BaseAgent


class MarketingPerformanceAgent(BaseAgent):
    name = "marketing_performance"
    description = "Analyze ad efficiency across acquisition channels."

    async def fetch_data(self, period: str) -> dict[str, Any]:
        return {
            "period": period,
            "channels": [
                {"channel": "meta_ads", "spend_ngn": 1_200_000, "conversions": 240, "revenue_ngn": 3_100_000},
                {"channel": "google_ads", "spend_ngn": 1_450_000, "conversions": 140, "revenue_ngn": 2_500_000},
                {"channel": "tiktok_ads", "spend_ngn": 620_000, "conversions": 130, "revenue_ngn": 1_700_000},
            ],
        }

    async def analyze(self, data: dict[str, Any]) -> list[AgentFinding]:
        channels = data["channels"]
        findings: list[AgentFinding] = []

        for entry in channels:
            cac = entry["spend_ngn"] / max(entry["conversions"], 1)
            roas = entry["revenue_ngn"] / max(entry["spend_ngn"], 1)

            if cac > 9_000 or roas < 2:
                findings.append(
                    AgentFinding(
                        type="budget_waste",
                        severity="high",
                        insight=(
                            f"{entry['channel']} CAC is NGN {cac:,.0f} with ROAS {roas:.2f}, below target efficiency."
                        ),
                        recommendation=f"Reduce {entry['channel']} budget by 25% and shift to better-performing channels.",
                        expected_impact="Lower wasted spend and improve blended CAC within 14 days.",
                        data={"channel": entry["channel"], "cac": cac, "roas": roas},
                    )
                )

        if not findings:
            findings.append(
                AgentFinding(
                    type="performance_stable",
                    severity="low",
                    insight="All paid channels are within efficiency target bands.",
                    recommendation="Keep current budget allocation and monitor weekly.",
                    expected_impact="Sustain current acquisition momentum.",
                )
            )

        return findings
