import { Injectable, Logger } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import axios from 'axios'
import { PrismaService } from '@revneu/database'

type ScheduleRunStatus = 'SUCCESS' | 'FAILED' | 'RUNNING'

interface TriggerRunAllResult {
  status: ScheduleRunStatus
  error: string | null
}

@Injectable()
export class AgentSchedulerService {
  private readonly logger = new Logger(AgentSchedulerService.name)

  constructor(private readonly prisma: PrismaService) {}

  @Cron('* * * * *')
  async scheduleDueAgentRuns(): Promise<void> {
    if (!this.isEnabled()) {
      return
    }

    await this.ensureOrganizationSchedules()

    const now = new Date()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prisma = this.prisma as any
    const schedules = await prisma.agentSchedule.findMany({
      where: { isEnabled: true },
      select: {
        id: true,
        organizationId: true,
        cadenceMinutes: true,
        lastTriggeredAt: true,
      },
      take: 1000,
    })

    for (const schedule of schedules) {
      const cadence = Math.max(5, schedule.cadenceMinutes)
      const nextDueAt = schedule.lastTriggeredAt
        ? new Date(schedule.lastTriggeredAt.getTime() + cadence * 60 * 1000)
        : new Date(0)

      if (nextDueAt > now) {
        continue
      }

      const hasActiveRun = await prisma.agentRun.findFirst({
        where: {
          organizationId: schedule.organizationId,
          status: { in: ['QUEUED', 'RUNNING'] },
        },
        select: { id: true },
      })

      if (hasActiveRun) {
        continue
      }

      const result = await this.triggerRunAll(schedule.organizationId)
      await prisma.agentSchedule.update({
        where: { id: schedule.id },
        data: {
          lastTriggeredAt: now,
          lastRunStatus: result.status,
          lastError: result.error,
        },
      })
    }
  }

  private isEnabled(): boolean {
    return (process.env.AGENT_SCHEDULER_ENABLED ?? 'true').toLowerCase() === 'true'
  }

  private async ensureOrganizationSchedules(): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prisma = this.prisma as any
    const organizations = await prisma.organization.findMany({
      select: { id: true },
      take: 1000,
    })

    if (organizations.length === 0) {
      return
    }

    const existing = await prisma.agentSchedule.findMany({
      select: { organizationId: true },
      take: 1000,
    })

    const existingIds = new Set(existing.map((item: { organizationId: string }) => item.organizationId))
    const toCreate = organizations
      .map((org: { id: string }) => org.id)
      .filter((orgId: string) => !existingIds.has(orgId))
      .map((organizationId: string) => ({
        organizationId,
        cadenceMinutes: this.defaultCadenceMinutes(),
        isEnabled: true,
      }))

    if (toCreate.length > 0) {
      await prisma.agentSchedule.createMany({
        data: toCreate,
        skipDuplicates: true,
      })
      this.logger.log(`Seeded ${toCreate.length} agent schedules`)
    }
  }

  private async triggerRunAll(organizationId: string): Promise<TriggerRunAllResult> {
    const agentServiceUrl = process.env.AGENT_SERVICE_URL ?? 'http://localhost:8000'
    const agentApiKey = process.env.AGENT_API_KEY
    const timeoutMs = this.triggerTimeoutMs()

    if (!agentApiKey) {
      this.logger.error('AGENT_API_KEY missing; cannot trigger scheduled agent runs')
      return { status: 'FAILED', error: 'AGENT_API_KEY missing' }
    }

    try {
      const response = await axios.post(
        `${agentServiceUrl}/api/v1/agents/run-all`,
        {
          tenant_id: organizationId,
          period: 'last_30_days',
        },
        {
          headers: {
            'x-agent-api-key': agentApiKey,
          },
          timeout: timeoutMs,
        },
      )

      const count = Number(response.data?.count ?? 0)
      this.logger.log(`Triggered scheduled run-all for org=${organizationId} count=${count}`)
      return { status: 'SUCCESS', error: null }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error'
      const timedOut =
        (typeof error === 'object' &&
          error !== null &&
          'code' in error &&
          (error as { code?: string }).code === 'ECONNABORTED') ||
        message.toLowerCase().includes('timeout')

      if (timedOut) {
        const timeoutError = `Agent trigger request timed out after ${timeoutMs}ms; run may still complete asynchronously`
        this.logger.warn(`Trigger timeout for org=${organizationId}: ${timeoutError}`)
        return { status: 'RUNNING', error: timeoutError }
      }

      this.logger.error(`Failed scheduled run-all for org=${organizationId}: ${message}`)
      return { status: 'FAILED', error: message }
    }
  }

  private triggerTimeoutMs(): number {
    const raw = Number(process.env.AGENT_SCHEDULER_TRIGGER_TIMEOUT_MS ?? 60_000)
    if (!Number.isFinite(raw)) {
      return 60_000
    }

    return Math.max(5_000, Math.floor(raw))
  }

  private defaultCadenceMinutes(): number {
    const raw = Number(process.env.AGENT_SCHEDULER_DEFAULT_CADENCE_MINUTES ?? 60)
    if (!Number.isFinite(raw)) {
      return 60
    }

    return Math.max(5, Math.floor(raw))
  }
}
