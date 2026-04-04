import { Controller, Get, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { Roles } from '../auth/decorators/roles.decorator'
import { TenantId } from '../auth/decorators/user.decorator'
import { BillingService } from './billing.service'

@Controller('billing')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get('plans')
  @Roles(['OWNER', 'ADMIN', 'ANALYST', 'VIEWER'])
  getPlans() {
    return this.billingService.getPlans()
  }

  @Get('subscription')
  @Roles(['OWNER', 'ADMIN', 'ANALYST', 'VIEWER'])
  getSubscription(@TenantId() tenantId: string) {
    return this.billingService.getSubscription(tenantId)
  }

  @Get('invoices')
  @Roles(['OWNER', 'ADMIN', 'ANALYST'])
  getInvoices(@TenantId() tenantId: string) {
    return this.billingService.getInvoices(tenantId)
  }
}
