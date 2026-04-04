import { Controller, Get, Query, UseGuards } from '@nestjs/common'
import type { IntegrationSource, MetricType } from '@revneu/database'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { Roles } from '../auth/decorators/roles.decorator'
import { TenantId } from '../auth/decorators/user.decorator'
import { MetricsService } from './metrics.service'

@Controller('api/v1/metrics')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get()
  @Roles(['OWNER', 'ADMIN', 'ANALYST', 'VIEWER'])
  async listMetrics(
    @TenantId() tenantId: string,
    @Query('source') source?: IntegrationSource,
    @Query('metricType') metricType?: MetricType,
  ) {
    return this.metricsService.listMetrics(tenantId, source, metricType)
  }
}
