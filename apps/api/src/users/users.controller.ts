import {
  ForbiddenException,
  Controller,
  Get,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common'
import { UsersService } from './users.service'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { Roles } from '../auth/decorators/roles.decorator'
import { User, TenantId } from '../auth/decorators/user.decorator'
import type { JwtPayload } from '../auth/strategies/jwt.strategy'

type UserRole = 'OWNER' | 'ADMIN' | 'ANALYST' | 'VIEWER'

@Controller('api/v1/users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get('team')
  @Roles(['OWNER', 'ADMIN'])
  getTeam(@TenantId() tenantId: string) {
    return this.usersService.getTeamMembers(tenantId)
  }

  @Get(':id')
  @Roles(['OWNER', 'ADMIN', 'ANALYST'])
  async getUser(@Param('id') id: string, @TenantId() tenantId: string) {
    const user = await this.usersService.getUser(id)

    if (user.organizationId !== tenantId) {
      throw new ForbiddenException('Unauthorized')
    }

    return user
  }

  @Put(':id')
  @Roles(['OWNER', 'ADMIN'])
  updateUser(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @Body() dto: { name?: string; role?: UserRole },
  ) {
    return this.usersService.updateUser(id, tenantId, dto)
  }

  @Delete(':id')
  @Roles(['OWNER', 'ADMIN'])
  removeUser(@Param('id') id: string, @TenantId() tenantId: string, @User() user: JwtPayload) {
    return this.usersService.removeUser(id, tenantId, user.sub)
  }
}
