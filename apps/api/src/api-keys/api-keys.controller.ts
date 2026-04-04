import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common'
import { ApiKeysService } from './api-keys.service'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { Roles } from '../auth/decorators/roles.decorator'
import { User, TenantId } from '../auth/decorators/user.decorator'
import type { JwtPayload } from '../auth/strategies/jwt.strategy'

@Controller('api-keys')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ApiKeysController {
  constructor(private apiKeysService: ApiKeysService) {}

  @Post()
  @Roles(['OWNER', 'ADMIN'])
  create(
    @TenantId() tenantId: string,
    @User() user: JwtPayload,
    @Body() dto: { name: string },
  ) {
    return this.apiKeysService.createApiKey(tenantId, user.sub, dto.name)
  }

  @Get()
  @Roles(['OWNER', 'ADMIN'])
  list(@TenantId() tenantId: string) {
    return this.apiKeysService.listApiKeys(tenantId)
  }

  @Delete(':id')
  @Roles(['OWNER', 'ADMIN'])
  revoke(@Param('id') id: string, @TenantId() tenantId: string, @User() user: JwtPayload) {
    return this.apiKeysService.revokeApiKey(tenantId, id, user.sub)
  }
}
