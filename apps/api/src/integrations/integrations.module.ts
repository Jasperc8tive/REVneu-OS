import { Module } from '@nestjs/common'
import { BillingModule } from '../billing/billing.module'
import { WorkersModule } from '../workers/workers.module'
import { IntegrationsController } from './integrations.controller'
import { IntegrationsService } from './integrations.service'
import { IntegrationWebhooksController } from './webhooks.controller'

@Module({
  imports: [WorkersModule, BillingModule],
  controllers: [IntegrationsController, IntegrationWebhooksController],
  providers: [IntegrationsService],
  exports: [IntegrationsService],
})
export class IntegrationsModule {}
