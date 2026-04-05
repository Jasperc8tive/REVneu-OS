from datetime import UTC, datetime
from time import perf_counter
from typing import Any
from uuid import uuid4

from fastapi import HTTPException

from agents.acquisition_agent import CustomerAcquisitionInsightsAgent
from agents.base_agent import AgentFinding, AgentOutput, BaseAgent
from agents.forecasting_agent import RevenueForecastingAgent
from agents.growth_agent import GrowthOpportunityAgent
from agents.marketing_agent import MarketingPerformanceAgent
from agents.pipeline_agent import SalesPipelineIntelligenceAgent
from agents.pricing_agent import PricingOptimizationAgent
from agents.retention_agent import CustomerRetentionAgent
from api.llm_proxy_client import LlmProxyClient
from api.persistence_client import AgentPersistenceClient
from api.schemas import AgentCheckpoint, AgentRunLog, RecommendationRecord


class AgentRuntime:
    def __init__(self) -> None:
        self._runs: list[AgentRunLog] = []
        self._recommendations: list[RecommendationRecord] = []
        self._checkpoints: list[AgentCheckpoint] = []
        self._persistence = AgentPersistenceClient()
        self._llm_proxy = LlmProxyClient()

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

        run_id = str(uuid4())
        agent = registry[agent_id](tenant_id=tenant_id)
        latest_checkpoint = self._latest_recovery_checkpoint(tenant_id, agent_id, period)
        recovered_stage = latest_checkpoint.stage if latest_checkpoint else None

        started_at = datetime.now(UTC)
        started_perf = perf_counter()
        run_log = AgentRunLog(
            run_id=run_id,
            tenant_id=tenant_id,
            agent_id=agent_id,
            period=period,
            status="running",
            started_at=started_at,
            metadata={
                "recovered_from_checkpoint": latest_checkpoint is not None,
                "checkpoint_stage": recovered_stage,
            },
        )

        stage = 'initialized'
        data: dict[str, Any] | None = None
        findings: list[AgentFinding] = []

        try:
            if latest_checkpoint and latest_checkpoint.stage == 'failed':
                checkpoint_data = latest_checkpoint.payload.get('data')
                if isinstance(checkpoint_data, dict):
                    data = checkpoint_data

            if data is None:
                data = await agent.fetch_data(period=period)
                stage = 'fetched'
                self._add_checkpoint(
                    run_id=run_id,
                    tenant_id=tenant_id,
                    agent_id=agent_id,
                    period=period,
                    stage=stage,
                    payload={'data': data},
                )

            if latest_checkpoint and latest_checkpoint.stage == 'failed':
                checkpoint_findings = latest_checkpoint.payload.get('findings')
                if isinstance(checkpoint_findings, list):
                    findings = [AgentFinding.model_validate(item) for item in checkpoint_findings]

            if not findings:
                findings = await agent.analyze(data)
                stage = 'analyzed'
                self._add_checkpoint(
                    run_id=run_id,
                    tenant_id=tenant_id,
                    agent_id=agent_id,
                    period=period,
                    stage=stage,
                    payload={
                        'data': data,
                        'findings': [finding.model_dump(mode='json') for finding in findings],
                    },
                )

            llm_summary: str | None = None
            llm_tokens = 0
            llm_cost = 0.0

            llm_payload = {
                'tenant_id': tenant_id,
                'agent_id': agent_id,
                'period': period,
                'system_context': {
                    'market': 'nigeria',
                    'currency': 'NGN',
                    'industry': 'smb',
                },
                'input': {
                    'data': data,
                    'candidate_findings': [finding.model_dump(mode='json') for finding in findings],
                },
            }
            llm_result = await self._llm_proxy.analyze(llm_payload)
            if llm_result is not None:
                findings = llm_result.findings
                llm_summary = llm_result.summary
                llm_tokens = llm_result.usage.tokens_used
                llm_cost = llm_result.usage.token_cost_usd
                stage = 'llm_structured'
                self._add_checkpoint(
                    run_id=run_id,
                    tenant_id=tenant_id,
                    agent_id=agent_id,
                    period=period,
                    stage=stage,
                    payload={
                        'data': data,
                        'findings': [finding.model_dump(mode='json') for finding in findings],
                        'summary': llm_summary,
                        'tokens_used': llm_tokens,
                        'token_cost_usd': llm_cost,
                    },
                )

            output = AgentOutput(
                agent=agent.name,
                tenant_id=tenant_id,
                period=period,
                run_id=run_id,
                findings=findings,
                summary=llm_summary,
                generated_at=datetime.now(UTC),
            )
            finished_at = datetime.now(UTC)
            duration_ms = int((perf_counter() - started_perf) * 1000)

            output.summary = output.summary or f"Generated {len(output.findings)} findings"
            output.tokens_used = output.tokens_used or (llm_tokens if llm_tokens > 0 else max(120, len(output.findings) * 180))

            run_log.status = "success"
            run_log.finished_at = finished_at
            run_log.duration_ms = duration_ms
            run_log.tokens_used = output.tokens_used
            run_log.token_cost_usd = round(llm_cost if llm_cost > 0 else output.tokens_used * 0.00001, 4)
            run_log.metadata = {
                **run_log.metadata,
                'final_stage': stage,
                'llm_enforced': self._llm_proxy.enabled,
            }

            self._runs.append(run_log)
            recommendation = RecommendationRecord(
                tenant_id=tenant_id,
                agent_id=agent_id,
                run_id=run_id,
                generated_at=output.generated_at,
                findings=[finding.model_dump() for finding in output.findings],
                summary=output.summary,
            )
            self._recommendations.append(recommendation)

            await self._persistence.persist_run(run_log)
            await self._persistence.persist_recommendation(recommendation)

            return output
        except Exception as exc:
            finished_at = datetime.now(UTC)
            duration_ms = int((perf_counter() - started_perf) * 1000)
            run_log.status = "failed"
            run_log.finished_at = finished_at
            run_log.duration_ms = duration_ms
            run_log.error = str(exc)
            run_log.metadata = {
                **run_log.metadata,
                'failed_stage': stage,
                'recovery_available': bool(findings),
            }
            self._runs.append(run_log)

            self._add_checkpoint(
                run_id=run_id,
                tenant_id=tenant_id,
                agent_id=agent_id,
                period=period,
                stage='failed',
                payload={
                    'error': str(exc),
                    'failed_stage': stage,
                    'data': data or {},
                    'findings': [finding.model_dump(mode='json') for finding in findings],
                },
            )

            await self._persistence.persist_run(run_log)

            if findings:
                partial_recommendation = RecommendationRecord(
                    tenant_id=tenant_id,
                    agent_id=agent_id,
                    run_id=run_id,
                    generated_at=datetime.now(UTC),
                    findings=[finding.model_dump(mode='json') for finding in findings],
                    summary=f"Partial results recovered after failure at stage '{stage}': {exc}",
                )
                self._recommendations.append(partial_recommendation)
                await self._persistence.persist_recommendation(partial_recommendation)

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

    async def list_checkpoints(
        self,
        tenant_id: str,
        agent_id: str | None = None,
    ) -> list[AgentCheckpoint]:
        scoped = [checkpoint for checkpoint in self._checkpoints if checkpoint.tenant_id == tenant_id]
        if agent_id:
            scoped = [checkpoint for checkpoint in scoped if checkpoint.agent_id == agent_id]
        return scoped

    def _latest_recovery_checkpoint(self, tenant_id: str, agent_id: str, period: str) -> AgentCheckpoint | None:
        scoped = [
            checkpoint
            for checkpoint in self._checkpoints
            if (
                checkpoint.tenant_id == tenant_id
                and checkpoint.agent_id == agent_id
                and checkpoint.period == period
                and checkpoint.stage == 'failed'
            )
        ]
        if not scoped:
            return None
        return max(scoped, key=lambda checkpoint: checkpoint.created_at)

    def _add_checkpoint(
        self,
        run_id: str,
        tenant_id: str,
        agent_id: str,
        period: str,
        stage: str,
        payload: dict[str, Any],
    ) -> None:
        self._checkpoints.append(
            AgentCheckpoint(
                run_id=run_id,
                tenant_id=tenant_id,
                agent_id=agent_id,
                period=period,
                stage=stage,
                created_at=datetime.now(UTC),
                payload=payload,
            ),
        )

    def get_persistence_telemetry(self) -> dict:
        return self._persistence.telemetry_snapshot()

    def get_persistence_dead_letters(self) -> list[dict]:
        return self._persistence.get_dead_letters()
