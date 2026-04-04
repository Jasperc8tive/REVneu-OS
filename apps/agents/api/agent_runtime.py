from datetime import UTC, datetime
from time import perf_counter

from fastapi import HTTPException

from agents.acquisition_agent import CustomerAcquisitionInsightsAgent
from agents.base_agent import AgentOutput, BaseAgent
from agents.forecasting_agent import RevenueForecastingAgent
from agents.growth_agent import GrowthOpportunityAgent
from agents.marketing_agent import MarketingPerformanceAgent
from agents.pipeline_agent import SalesPipelineIntelligenceAgent
from agents.pricing_agent import PricingOptimizationAgent
from agents.retention_agent import CustomerRetentionAgent
from api.persistence_client import AgentPersistenceClient
from api.schemas import AgentRunLog, RecommendationRecord


class AgentRuntime:
    def __init__(self) -> None:
        self._runs: list[AgentRunLog] = []
        self._recommendations: list[RecommendationRecord] = []
        self._persistence = AgentPersistenceClient()

    @staticmethod
    def agent_registry() -> dict[str, type[BaseAgent]]:
        return {
            "marketing_performance": MarketingPerformanceAgent,
            "customer_acquisition": CustomerAcquisitionInsightsAgent,
            "sales_pipeline": SalesPipelineIntelligenceAgent,
            "revenue_forecasting": RevenueForecastingAgent,
            "pricing_optimization": PricingOptimizationAgent,
            "customer_retention": CustomerRetentionAgent,
            "growth_opportunity": GrowthOpportunityAgent,
        }

    async def run_agent(self, agent_id: str, tenant_id: str, period: str) -> AgentOutput:
        registry = self.agent_registry()
        if agent_id not in registry:
            raise HTTPException(status_code=404, detail=f"Unknown agent_id: {agent_id}")

        agent = registry[agent_id](tenant_id=tenant_id)

        started_at = datetime.now(UTC)
        started_perf = perf_counter()
        run_log = AgentRunLog(
            run_id="pending",
            tenant_id=tenant_id,
            agent_id=agent_id,
            period=period,
            status="running",
            started_at=started_at,
        )

        try:
            output = await agent.run(period=period)
            finished_at = datetime.now(UTC)
            duration_ms = int((perf_counter() - started_perf) * 1000)

            output.summary = output.summary or f"Generated {len(output.findings)} findings"
            output.tokens_used = output.tokens_used or max(120, len(output.findings) * 180)

            run_log.run_id = output.run_id
            run_log.status = "success"
            run_log.finished_at = finished_at
            run_log.duration_ms = duration_ms
            run_log.tokens_used = output.tokens_used
            run_log.token_cost_usd = round(output.tokens_used * 0.00001, 4)

            self._runs.append(run_log)
            recommendation = RecommendationRecord(
                tenant_id=tenant_id,
                agent_id=agent_id,
                run_id=output.run_id,
                generated_at=output.generated_at,
                findings=[finding.model_dump() for finding in output.findings],
                summary=output.summary,
            )
            self._recommendations.append(recommendation)

            await self._persistence.persist_run(run_log)
            await self._persistence.persist_recommendation(recommendation)

            return output
        except Exception as exc:  # pragma: no cover
            finished_at = datetime.now(UTC)
            duration_ms = int((perf_counter() - started_perf) * 1000)
            run_log.status = "failed"
            run_log.finished_at = finished_at
            run_log.duration_ms = duration_ms
            run_log.error = str(exc)
            self._runs.append(run_log)

            await self._persistence.persist_run(run_log)
            raise

    async def run_all_agents(self, tenant_id: str, period: str) -> list[AgentOutput]:
        outputs: list[AgentOutput] = []
        for agent_id in self.agent_registry():
            outputs.append(await self.run_agent(agent_id=agent_id, tenant_id=tenant_id, period=period))
        return outputs

    async def list_runs(self, tenant_id: str, agent_id: str | None = None) -> list[AgentRunLog]:
        persisted = await self._persistence.list_runs(tenant_id=tenant_id, agent_id=agent_id)
        if persisted is not None:
            return persisted

        scoped = [run for run in self._runs if run.tenant_id == tenant_id]
        if agent_id:
            scoped = [run for run in scoped if run.agent_id == agent_id]
        return scoped

    async def list_recommendations(
        self,
        tenant_id: str,
        agent_id: str | None = None,
    ) -> list[RecommendationRecord]:
        persisted = await self._persistence.list_recommendations(tenant_id=tenant_id, agent_id=agent_id)
        if persisted is not None:
            return persisted

        scoped = [item for item in self._recommendations if item.tenant_id == tenant_id]
        if agent_id:
            scoped = [item for item in scoped if item.agent_id == agent_id]
        return scoped
