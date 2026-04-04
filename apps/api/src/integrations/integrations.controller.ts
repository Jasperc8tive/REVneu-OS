import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common'
import type { Response } from 'express'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { Roles } from '../auth/decorators/roles.decorator'
import { TenantId, User } from '../auth/decorators/user.decorator'
import type { JwtPayload } from '../auth/strategies/jwt.strategy'
import { CreateIntegrationDto } from './dto/create-integration.dto'
import { IntegrationsService } from './integrations.service'

@Controller('integrations')
export class IntegrationsController {
  constructor(private readonly integrationsService: IntegrationsService) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(['OWNER', 'ADMIN', 'ANALYST'])
  async listIntegrations(@TenantId() tenantId: string) {
    return this.integrationsService.listIntegrations(tenantId)
  }

  @Post('connect')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(['OWNER', 'ADMIN'])
  async connectIntegration(
    @TenantId() tenantId: string,
    @User() user: JwtPayload,
    @Body() dto: CreateIntegrationDto,
  ) {
    return this.integrationsService.createIntegration(tenantId, user.sub, dto)
  }

  @Get('oauth/:source/start')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(['OWNER', 'ADMIN'])
  async oauthStart(
    @TenantId() tenantId: string,
    @User() user: JwtPayload,
    @Param('source') source: 'GA4' | 'META_ADS' | 'GOOGLE_ADS',
    @Query('displayName') displayName?: string,
    @Query('syncIntervalMinutes') syncIntervalMinutes?: string,
  ) {
    if (source !== 'GA4' && source !== 'META_ADS' && source !== 'GOOGLE_ADS') {
      throw new BadRequestException('OAuth is only supported for GA4, META_ADS, and GOOGLE_ADS')
    }

    const interval = syncIntervalMinutes ? Number(syncIntervalMinutes) : 60
    if (!Number.isFinite(interval) || interval < 5 || interval > 1440) {
      throw new BadRequestException('syncIntervalMinutes must be between 5 and 1440')
    }

    return this.integrationsService.getOAuthStartUrl(tenantId, user.sub, source, displayName, interval)
  }

  @Get('oauth/:source/callback')
  @HttpCode(302)
  async oauthCallback(
    @Param('source') source: 'GA4' | 'META_ADS' | 'GOOGLE_ADS',
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() response: Response,
  ) {
    const frontendBase = process.env.FRONTEND_URL ?? 'http://localhost:3000'

    try {
      if (source !== 'GA4' && source !== 'META_ADS' && source !== 'GOOGLE_ADS') {
        throw new BadRequestException('Unsupported OAuth source')
      }

      await this.integrationsService.completeOAuthCallback(source, code, state)
      return response.redirect(`${frontendBase}/integrations?oauth=connected&source=${source}`)
    } catch {
      return response.redirect(`${frontendBase}/integrations?oauth=failed&source=${source}`)
    }
  }

  @Post(':id/sync')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(['OWNER', 'ADMIN', 'ANALYST'])
  async syncIntegration(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.integrationsService.triggerSync(tenantId, id)
  }

  @Get(':id/health')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(['OWNER', 'ADMIN', 'ANALYST'])
  async integrationHealth(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.integrationsService.integrationHealth(tenantId, id)
  }

  @Get(':id/history')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(['OWNER', 'ADMIN', 'ANALYST'])
  async integrationHistory(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.integrationsService.syncHistory(tenantId, id)
  }

  @Patch(':id/disconnect')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(['OWNER', 'ADMIN'])
  async disconnectIntegration(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.integrationsService.disconnectIntegration(tenantId, id)
  }
}
