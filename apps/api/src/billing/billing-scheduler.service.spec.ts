import { BillingSchedulerService } from './billing-scheduler.service'

describe('BillingSchedulerService', () => {
  const prismaMock = {
    organization: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
    $queryRaw: jest.fn(),
    $executeRaw: jest.fn(),
  }

  const eventEmitterMock = {
    emit: jest.fn(),
  }

  let service: BillingSchedulerService

  beforeEach(() => {
    jest.clearAllMocks()
    service = new BillingSchedulerService(prismaMock as never, eventEmitterMock as never)
  })

  it('expires trial orgs to STARTER/ACTIVE and emits billing.trial.expired', async () => {
    prismaMock.organization.findMany.mockResolvedValue([
      { id: 'org-trial-1', name: 'Trial Org' },
    ])
    prismaMock.organization.update.mockResolvedValue({})
    prismaMock.auditLog.create.mockResolvedValue({})

    await service.expireTrials()

    expect(prismaMock.organization.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'org-trial-1' },
        data: {
          subscriptionTier: 'STARTER',
          subscriptionStatus: 'ACTIVE',
          trialEndsAt: null,
        },
      }),
    )

    expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'billing.trial.expired',
          organizationId: 'org-trial-1',
        }),
      }),
    )

    expect(eventEmitterMock.emit).toHaveBeenCalledWith(
      'billing.trial.expired',
      expect.objectContaining({ organizationId: 'org-trial-1' }),
    )
  })

  it('does nothing when no expired trial orgs exist', async () => {
    prismaMock.organization.findMany.mockResolvedValue([])

    await service.expireTrials()

    expect(prismaMock.organization.update).not.toHaveBeenCalled()
    expect(prismaMock.auditLog.create).not.toHaveBeenCalled()
    expect(eventEmitterMock.emit).not.toHaveBeenCalled()
  })
})
