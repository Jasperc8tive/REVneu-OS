import { Injectable, Logger } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { PrismaService } from '@revneu/database'
import { SyncQueueService } from './sync.queue.service'

@Injectable()
export class IntegrationSchedulerService {
  private readonly logger = new Logger(IntegrationSchedulerService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly syncQueueService: SyncQueueService,
  ) {}

  @Cron('* * * * *')
  async scheduleDueIntegrations(): Promise<void> {
    const now = new Date()
    const activeIntegrations = await this.prisma.integrationConnection.findMany({
      where: { status: 'ACTIVE' },
      select: {
        id: true,
        organizationId: true,
        syncIntervalMinutes: true,
        lastSyncAt: true,
      },
      take: 500,
    })

    for (const integration of activeIntegrations) {
      const intervalMinutes = Math.max(5, integration.syncIntervalMinutes)
      const nextDueAt = integration.lastSyncAt
        ? new Date(integration.lastSyncAt.getTime() + intervalMinutes * 60 * 1000)
        : new Date(0)

      if (nextDueAt > now) {
        continue
      }

      const hasActiveRun = await this.prisma.integrationSyncRun.findFirst({
        where: {
          integrationId: integration.id,
          status: { in: ['QUEUED', 'RUNNING'] },
        },
        select: { id: true },
      })

      if (hasActiveRun) {
        continue
      }

      const syncRun = await this.prisma.integrationSyncRun.create({
        data: {
          organizationId: integration.organizationId,
          integrationId: integration.id,
          status: 'QUEUED',
        },
      })

      await this.syncQueueService.enqueueSyncRun(syncRun.id)
      this.logger.log(`Scheduled recurring sync for integration ${integration.id}`)
    }
  }
}
