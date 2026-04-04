import { Controller, Get, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { Roles } from '../auth/decorators/roles.decorator'
import { TenantId } from '../auth/decorators/user.decorator'
import { ForecastsService } from './forecasts.service'

@Controller('forecasts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ForecastsController {
  constructor(private readonly forecastsService: ForecastsService) {}

  @Get()
  @Roles(['OWNER', 'ADMIN', 'ANALYST', 'VIEWER'])
  getForecasts(@TenantId() tenantId: string) {
    return this.forecastsService.getForecasts(tenantId)
  }
}
