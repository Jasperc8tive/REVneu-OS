import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { Roles } from '../auth/decorators/roles.decorator'
import { TenantId } from '../auth/decorators/user.decorator'
import { InternalAgentGuard } from '../common/guards/internal-agent.guard'
import { AgentRunsService } from './agent-runs.service'
import { CreateAgentRunDto } from './dto/create-agent-run.dto'

@Controller('agent-runs')
export class AgentRunsController {
  constructor(private readonly agentRunsService: AgentRunsService) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(['OWNER', 'ADMIN', 'ANALYST', 'VIEWER'])
  async listRuns(@TenantId() tenantId: string, @Query('agentId') agentId?: string) {
    return this.agentRunsService.listRuns(tenantId, agentId)
  }

  @Get('internal')
  @UseGuards(InternalAgentGuard)
  async listRunsInternal(
    @Query('organizationId') organizationId: string,
    @Query('agentId') agentId?: string,
  ) {
    return this.agentRunsService.listRuns(organizationId, agentId)
  }

  @Post('internal')
  @UseGuards(InternalAgentGuard)
  async createRunInternal(@Body() dto: CreateAgentRunDto) {
    return this.agentRunsService.createRun(dto)
  }
}
