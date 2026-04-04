import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { Roles } from '../auth/decorators/roles.decorator'
import { TenantId } from '../auth/decorators/user.decorator'
import { OnboardingService, type OnboardingStep } from './onboarding.service'

@Controller('onboarding')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  @Get('progress')
  @Roles(['OWNER', 'ADMIN', 'ANALYST', 'VIEWER'])
  getProgress(@TenantId() tenantId: string) {
    return this.onboardingService.getProgress(tenantId)
  }

  @Post('complete/:step')
  @Roles(['OWNER', 'ADMIN'])
  completeStep(@TenantId() tenantId: string, @Param('step') step: string) {
    return this.onboardingService.completeStep(tenantId, step as OnboardingStep)
  }
}
