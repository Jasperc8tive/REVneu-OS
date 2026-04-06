import { MetricsService } from './metrics.service'

describe('MetricsService', () => {
  const prismaMock = {
    metricRecord: {
      findMany: jest.fn(),
      createMany: jest.fn(),
    },
  }

  let service: MetricsService

  beforeEach(() => {
    jest.clearAllMocks()
    service = new MetricsService(prismaMock as never)
  })

  it('queries metric records scoped by tenant organizationId', async () => {
    prismaMock.metricRecord.findMany.mockResolvedValue([])

    await service.listMetrics('org-tenant-a')

    expect(prismaMock.metricRecord.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: 'org-tenant-a' },
      }),
    )
  })

  it('adds optional source and metricType filters while preserving tenant scope', async () => {
    prismaMock.metricRecord.findMany.mockResolvedValue([])

    await service.listMetrics('org-tenant-b', 'PAYSTACK', 'REVENUE')

    expect(prismaMock.metricRecord.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organizationId: 'org-tenant-b',
          source: 'PAYSTACK',
          metricType: 'REVENUE',
        },
      }),
    )
  })
})
