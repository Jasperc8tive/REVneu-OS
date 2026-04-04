import { Module } from '@nestjs/common'
import { ScheduleModule } from '@nestjs/schedule'
import { EventEmitterModule } from '@nestjs/event-emitter'
import { AuditService } from './services/audit.service'
import { IntegrationObservabilityService } from './services/integration-observability.service'
import { RateLimitService } from './services/rate-limit.service'

@Module({
  imports: [ScheduleModule.forRoot(), EventEmitterModule],
  providers: [AuditService, RateLimitService, IntegrationObservabilityService],
  exports: [AuditService, RateLimitService, IntegrationObservabilityService],
})
export class CommonModule {}
