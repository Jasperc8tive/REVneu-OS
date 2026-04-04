import { InjectQueue } from '@nestjs/bullmq'
import { Injectable } from '@nestjs/common'
import { Queue } from 'bullmq'

@Injectable()
export class SyncQueueService {
  constructor(@InjectQueue('integration-sync') private readonly syncQueue: Queue) {}

  async enqueueSyncRun(syncRunId: string): Promise<void> {
    await this.syncQueue.add(
      'run',
      { syncRunId },
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 30_000,
        },
        removeOnComplete: 50,
        removeOnFail: 100,
      },
    )
  }
}
