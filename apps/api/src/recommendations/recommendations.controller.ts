import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { Roles } from '../auth/decorators/roles.decorator'
import { TenantId } from '../auth/decorators/user.decorator'
import { InternalAgentGuard } from '../common/guards/internal-agent.guard'
import { CreateRecommendationDto } from './dto/create-recommendation.dto'
import { RecommendationsService } from './recommendations.service'

@Controller(['recommendations', 'api/v1/recommendations'])
export class RecommendationsController {
  constructor(private readonly recommendationsService: RecommendationsService) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(['OWNER', 'ADMIN', 'ANALYST', 'VIEWER'])
  async listRecommendations(@TenantId() tenantId: string, @Query('agentId') agentId?: string) {
    return this.recommendationsService.listRecommendations(tenantId, agentId)
  }

  @Get(['internal', 'api/v1/internal'])
  @UseGuards(InternalAgentGuard)
  async listRecommendationsInternal(
    @Query('organizationId') organizationId: string,
    @Query('agentId') agentId?: string,
  ) {
    return this.recommendationsService.listRecommendations(organizationId, agentId)
  }

  @Post(['internal', 'api/v1/internal'])
  @UseGuards(InternalAgentGuard)
  async createRecommendationInternal(@Body() dto: CreateRecommendationDto) {
    return this.recommendationsService.createRecommendation(dto)
  }
}
