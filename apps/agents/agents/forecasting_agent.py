from datetime import UTC, datetime, timedelta
from typing import Any

from agents.base_agent import AgentFinding, BaseAgent


class RevenueForecastingAgent(BaseAgent):
    name = "revenue_forecasting"
    description = "Forecast near-term revenue and detect target variance risks."

    async def fetch_data(self, period: str) -> dict[str, Any]:
        return {
            "period": period,
            "current_run_rate_ngn": 12_800_000,
            "target_next_30d_ngn": 14_000_000,
            "seasonality_factor": 0.94,
        }

    async def analyze(self, data: dict[str, Any]) -> list[AgentFinding]:
        now_utc = datetime.now(tz=UTC)
        projected = data["current_run_rate_ngn"] * data["seasonality_factor"]
        target = data["target_next_30d_ngn"]
        gap = target - projected

        if gap > 0:
            return [
                AgentFinding(
                    type="forecast_gap",
                    severity="high" if gap > 1_000_000 else "medium",
                    insight=f"Projected next 30 days revenue is NGN {projected:,.0f}, below target by NGN {gap:,.0f}.",
                    recommendation="Prioritize high-conversion campaigns and accelerate late-stage pipeline opportunities.",
                    expected_impact="Close forecast variance and improve short-term cash flow confidence.",
                    data={
                        "projected_ngn": projected,
                        "target_ngn": target,
                        "gap_ngn": gap,
                        "as_of": now_utc.isoformat(),
                        "horizon_end": (now_utc + timedelta(days=30)).date().isoformat(),
                    },
                )
            ]

        return [
            AgentFinding(
                type="forecast_on_track",
                severity="low",
                insight=f"Projected revenue NGN {projected:,.0f} is on or above target.",
                recommendation="Maintain current growth plan and monitor weekly variance.",
                expected_impact="Sustain forecast reliability.",
            )
        ]
