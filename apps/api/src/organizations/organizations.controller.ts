import {
  Controller,
  Get,
  Put,
  Body,
  UseGuards,
  Param,
} from '@nestjs/common'
import { OrganizationsService, UpdateOrganizationDto } from './organizations.service'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { User, TenantId } from '../auth/decorators/user.decorator'
import type { JwtPayload } from '../auth/strategies/jwt.strategy'

@Controller('api/v1/organizations')
export class OrganizationsController {
  constructor(private organizationsService: OrganizationsService) {}

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  getOrganization(@Param('id') id: string, @TenantId() tenantId: string) {
    // Ensure user only accesses their own organization
    if (id !== tenantId) {
      throw new Error('Unauthorized')
    }
    return this.organizationsService.getOrganization(id)
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  updateOrganization(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @User() user: JwtPayload,
    @Body() dto: UpdateOrganizationDto,
  ) {
    if (id !== tenantId) {
      throw new Error('Unauthorized')
    }
    return this.organizationsService.updateOrganization(id, user.sub, dto)
  }
}
