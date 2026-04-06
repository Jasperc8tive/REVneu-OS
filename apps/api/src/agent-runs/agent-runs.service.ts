import { Injectable } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { PrismaService } from '@revneu/database'
import { BillingService } from '../billing/billing.service'
import { CreateAgentRunDto } from './dto/create-agent-run.dto'

@Injectable()
export class AgentRunsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly billingService: BillingService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async createRun(dto: CreateAgentRunDto) {
    const existingAgents = await this.prisma.agentRun.findMany({
      where: { organizationId: dto.organizationId },
      distinct: ['agentId'],
      select: { agentId: true },
    })

    const hasAgent = existingAgents.some((item) => item.agentId === dto.agentId)
    if (!hasAgent) {
      await this.billingService.assertWithinLimit(dto.organizationId, 'agents')
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prisma = this.prisma as any
    const run = await prisma.agentRun.create({
      data: {
        ...(dto.id ? { id: dto.id } : {}),
        organizationId: dto.organizationId,
        agentId: dto.agentId,
        period: dto.period,
        status: dto.status,
        startedAt: dto.startedAt ? new Date(dto.startedAt) : new Date(),
        finishedAt: dto.finishedAt ? new Date(dto.finishedAt) : undefined,
        durationMs: dto.durationMs,
        tokensUsed: dto.tokensUsed ?? 0,
        tokenCostUsd: dto.tokenCostUsd ?? 0,
        error: dto.error,
        metadata: dto.metadata as unknown as object,
      },
    })

    this.eventEmitter.emit('audit', {
      organizationId: dto.organizationId,
      action: 'agent_run.created',
      resourceType: 'agent_run',
      resourceId: run.id,
      changes: {
        agentId: dto.agentId,
        status: dto.status,
        period: dto.period,
      },
    })

    return run
  }

  async listRuns(organizationId: string, agentId?: string) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prisma = this.prisma as any
    const runs = await prisma.agentRun.findMany({
      where: {
        organizationId,
        ...(agentId ? { agentId } : {}),
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 100,
    })

    this.eventEmitter.emit('audit', {
      organizationId,
      action: 'agent_run.listed',
      resourceType: 'agent_run',
      changes: {
        agentId: agentId ?? null,
        returnedCount: runs.length,
      },
    })

    return runs
  }
}