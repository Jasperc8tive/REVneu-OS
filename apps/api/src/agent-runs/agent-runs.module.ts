import { Module } from '@nestjs/common'
import { BillingModule } from '../billing/billing.module'
import { AgentRunsController } from './agent-runs.controller'
import { AgentRunsService } from './agent-runs.service'

@Module({
  imports: [BillingModule],
  controllers: [AgentRunsController],
  providers: [AgentRunsService],
  exports: [AgentRunsService],
})
export class AgentRunsModule {}
