import { Injectable } from '@nestjs/common'
import { PrismaService } from '@revneu/database'
import { CreateRecommendationDto } from './dto/create-recommendation.dto'

@Injectable()
export class RecommendationsService {
  constructor(private readonly prisma: PrismaService) {}

  async createRecommendation(dto: CreateRecommendationDto) {
    return this.prisma.recommendation.create({
      data: {
        organizationId: dto.organizationId,
        agentRunId: dto.agentRunId,
        agentId: dto.agentId,
        summary: dto.summary,
        findings: dto.findings as unknown as object,
      },
    })
  }

  async listRecommendations(organizationId: string, agentId?: string) {
    return this.prisma.recommendation.findMany({
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