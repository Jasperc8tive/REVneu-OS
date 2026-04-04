import { Module } from '@nestjs/common'
import { EventEmitterModule } from '@nestjs/event-emitter'
import { BillingController } from './billing.controller'
import { BillingSchedulerService } from './billing-scheduler.service'
import { BillingService } from './billing.service'

@Module({
  imports: [EventEmitterModule],
  controllers: [BillingController],
  providers: [BillingService, BillingSchedulerService],
  exports: [BillingService],
})
export class BillingModule {}
