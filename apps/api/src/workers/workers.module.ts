import { BullModule } from '@nestjs/bullmq'
import { Module } from '@nestjs/common'
import { PipelineModule } from '../pipeline/pipeline.module'
import { IntegrationSchedulerService } from './integration-scheduler.service'
import { SyncProcessor } from './sync.processor'
import { SyncQueueService } from './sync.queue.service'

@Module({
  imports: [
    PipelineModule,
    BullModule.registerQueue({
      name: 'integration-sync',
    }),
  ],
  providers: [SyncQueueService, SyncProcessor, IntegrationSchedulerService],
  exports: [SyncQueueService],
})
export class WorkersModule {}
