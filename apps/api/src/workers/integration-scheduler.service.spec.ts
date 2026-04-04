import { IntegrationSchedulerService } from './integration-scheduler.service'

describe('IntegrationSchedulerService', () => {
  const prismaMock = {
    integrationConnection: {
      findMany: jest.fn(),
    },
    integrationSyncRun: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
  }

  const syncQueueServiceMock = {
    enqueueSyncRun: jest.fn(),
  }

  let service: IntegrationSchedulerService

  beforeEach(() => {
    jest.clearAllMocks()
    service = new IntegrationSchedulerService(
      prismaMock as never,
      syncQueueServiceMock as never,
    )
  })

  it('enqueues only due integrations without active queued/running jobs', async () => {
    const now = Date.now()

    prismaMock.integrationConnection.findMany.mockResolvedValue([
      {
        id: 'int-due',
        organizationId: 'org-1',
        syncIntervalMinutes: 15,
        lastSyncAt: new Date(now - 20 * 60 * 1000),
      },
      {
        id: 'int-not-due',
        organizationId: 'org-1',
        syncIntervalMinutes: 30,
        lastSyncAt: new Date(now - 10 * 60 * 1000),
      },
      {
        id: 'int-has-active-run',
        organizationId: 'org-2',
        syncIntervalMinutes: 15,
        lastSyncAt: new Date(now - 20 * 60 * 1000),
      },
    ])

    prismaMock.integrationSyncRun.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'existing-run' })

    prismaMock.integrationSyncRun.create.mockResolvedValue({ id: 'new-run-1' })
    syncQueueServiceMock.enqueueSyncRun.mockResolvedValue(undefined)

    await service.scheduleDueIntegrations()

    expect(prismaMock.integrationSyncRun.create).toHaveBeenCalledTimes(1)
    expect(prismaMock.integrationSyncRun.create).toHaveBeenCalledWith({
      data: {
        organizationId: 'org-1',
        integrationId: 'int-due',
        status: 'QUEUED',
      },
    })

    expect(syncQueueServiceMock.enqueueSyncRun).toHaveBeenCalledWith('new-run-1')
  })

  it('enforces a minimum interval of 5 minutes when deciding due status', async () => {
    const now = Date.now()

    prismaMock.integrationConnection.findMany.mockResolvedValue([
      {
        id: 'int-too-soon',
        organizationId: 'org-1',
        syncIntervalMinutes: 1,
        lastSyncAt: new Date(now - 4 * 60 * 1000),
      },
      {
        id: 'int-minimum-due',
        organizationId: 'org-1',
        syncIntervalMinutes: 1,
        lastSyncAt: new Date(now - 6 * 60 * 1000),
      },
    ])

    prismaMock.integrationSyncRun.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)

    prismaMock.integrationSyncRun.create
      .mockResolvedValueOnce({ id: 'new-run-2' })

    syncQueueServiceMock.enqueueSyncRun.mockResolvedValue(undefined)

    await service.scheduleDueIntegrations()

    expect(prismaMock.integrationSyncRun.create).toHaveBeenCalledTimes(1)
    expect(prismaMock.integrationSyncRun.create).toHaveBeenCalledWith({
      data: {
        organizationId: 'org-1',
        integrationId: 'int-minimum-due',
        status: 'QUEUED',
      },
    })
  })
})
