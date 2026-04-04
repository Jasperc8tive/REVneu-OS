import { Body, Controller, Header, Headers, Get, HttpCode, Param, Post, Req, UseGuards } from '@nestjs/common'
import type { Request } from 'express'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { Roles } from '../auth/decorators/roles.decorator'
import { TenantId } from '../auth/decorators/user.decorator'
import { BillingService } from './billing.service'
import { CreateCheckoutDto } from './dto/create-checkout.dto'

@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get('plans')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(['OWNER', 'ADMIN', 'ANALYST', 'VIEWER'])
  getPlans() {
    return this.billingService.getPlans()
  }

  @Get('subscription')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(['OWNER', 'ADMIN', 'ANALYST', 'VIEWER'])
  getSubscription(@TenantId() tenantId: string) {
    return this.billingService.getSubscription(tenantId)
  }

  @Get('invoices')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(['OWNER', 'ADMIN', 'ANALYST'])
  getInvoices(@TenantId() tenantId: string) {
    return this.billingService.getInvoices(tenantId)
  }

  @Get('invoices/:id/pdf')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(['OWNER', 'ADMIN', 'ANALYST'])
  @Header('Content-Type', 'application/pdf')
  @Header('Content-Disposition', 'attachment; filename="invoice.pdf"')
  getInvoicePdf(@Param('id') id: string, @TenantId() tenantId: string) {
    return this.billingService.generateInvoicePdf(id, tenantId)
  }

  @Get('usage')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(['OWNER', 'ADMIN', 'ANALYST', 'VIEWER'])
  getUsage(@TenantId() tenantId: string) {
    return this.billingService.getFeatureGateSummary(tenantId)
  }

  @Post('checkout/paystack')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(['OWNER', 'ADMIN'])
  createPaystackCheckout(@TenantId() tenantId: string, @Body() dto: CreateCheckoutDto) {
    return this.billingService.createPaystackCheckout(tenantId, dto)
  }

  @Post('checkout/stripe')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(['OWNER', 'ADMIN'])
  createStripeCheckout(@TenantId() tenantId: string, @Body() dto: CreateCheckoutDto) {
    return this.billingService.createStripeCheckout(tenantId, dto)
  }

  @Post('webhooks/paystack')
  @HttpCode(200)
  async paystackWebhook(
    @Req() request: Request & { rawBody?: Buffer },
    @Headers('x-paystack-signature') signature?: string,
  ) {
    return this.billingService.handlePaystackWebhook(request.rawBody ?? JSON.stringify(request.body ?? {}), signature)
  }

  @Post('webhooks/stripe')
  @HttpCode(200)
  async stripeWebhook(
    @Req() request: Request & { rawBody?: Buffer },
    @Headers('stripe-signature') signature?: string,
  ) {
    return this.billingService.handleStripeWebhook(request.rawBody ?? JSON.stringify(request.body ?? {}), signature)
  }
}
