import { RecommendationsService } from './recommendations.service'

describe('RecommendationsService', () => {
  const prismaMock = {
    recommendation: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
  }

  let service: RecommendationsService

  beforeEach(() => {
    jest.clearAllMocks()
    service = new RecommendationsService(prismaMock as never)
  })

  it('creates recommendation row', async () => {
    prismaMock.recommendation.create.mockResolvedValue({ id: 'rec-1' })

    await service.createRecommendation({
      organizationId: 'org-1',
      agentRunId: 'run-1',
      agentId: 'marketing_performance',
      summary: 'summary',
      findings: [{ type: 'test' }],
    })

    expect(prismaMock.recommendation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: 'org-1',
          agentRunId: 'run-1',
          agentId: 'marketing_performance',
        }),
      }),
    )
  })

  it('lists recommendations scoped by tenant and optional agent', async () => {
    prismaMock.recommendation.findMany.mockResolvedValue([])

    await service.listRecommendations('org-1', 'marketing_performance')

    expect(prismaMock.recommendation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organizationId: 'org-1',
          agentId: 'marketing_performance',
        },
      }),
    )
  })
})
