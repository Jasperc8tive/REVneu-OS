import { Processor, WorkerHost } from '@nestjs/bullmq'
import { Logger } from '@nestjs/common'
import { Job } from 'bullmq'
import { PipelineService } from '../pipeline/pipeline.service'

@Processor('integration-sync')
export class SyncProcessor extends WorkerHost {
  private readonly logger = new Logger(SyncProcessor.name)

  constructor(private readonly pipelineService: PipelineService) {
    super()
  }

  async process(job: Job<{ syncRunId: string }>): Promise<void> {
    this.logger.log(`Processing integration sync job ${job.id}`)
    await this.pipelineService.runSyncRun(job.data.syncRunId)
  }
}
