import { AgentRunsService } from './agent-runs.service'

describe('AgentRunsService', () => {
  const prismaMock = {
    agentRun: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
  }

  const billingServiceMock = {
    assertWithinLimit: jest.fn(),
  }

  let service: AgentRunsService

  beforeEach(() => {
    jest.clearAllMocks()
    service = new AgentRunsService(prismaMock as never, billingServiceMock as never)
  })

  it('creates an agent run record', async () => {
    prismaMock.agentRun.findMany.mockResolvedValue([{ agentId: 'marketing_performance' }])
    prismaMock.agentRun.create.mockResolvedValue({ id: 'run-1' })

    await service.createRun({
      id: 'run-1',
      organizationId: 'org-1',
      agentId: 'marketing_performance',
      period: 'last_30_days',
      status: 'SUCCESS',
      tokensUsed: 120,
      tokenCostUsd: 0.0012,
      metadata: { run_id: 'run-1' },
    })

    expect(prismaMock.agentRun.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          id: 'run-1',
          organizationId: 'org-1',
          agentId: 'marketing_performance',
          status: 'SUCCESS',
        }),
      }),
    )
  })

  it('lists runs scoped by organization and optional agent', async () => {
    prismaMock.agentRun.findMany.mockResolvedValue([])

    await service.listRuns('org-1', 'marketing_performance')

    expect(prismaMock.agentRun.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organizationId: 'org-1',
          agentId: 'marketing_performance',
        },
      }),
    )
  })
})
