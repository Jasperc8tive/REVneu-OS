import { Injectable } from '@nestjs/common'
import { PrismaService } from '@revneu/database'
import { CreateAgentRunDto } from './dto/create-agent-run.dto'

@Injectable()
export class AgentRunsService {
  constructor(private readonly prisma: PrismaService) {}

  async createRun(dto: CreateAgentRunDto) {
    return this.prisma.agentRun.create({
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
  }

  async listRuns(organizationId: string, agentId?: string) {
    return this.prisma.agentRun.findMany({
      where: {
        organizationId,
        ...(agentId ? { agentId } : {}),
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 100,
    })
  }
}