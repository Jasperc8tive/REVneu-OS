import { AgentRunsController } from './agent-runs.controller'

describe('AgentRunsController', () => {
  const serviceMock = {
    listRuns: jest.fn(),
    createRun: jest.fn(),
  }

  let controller: AgentRunsController

  beforeEach(() => {
    jest.clearAllMocks()
    controller = new AgentRunsController(serviceMock as never)
  })

  it('uses tenant id from auth context for public list endpoint', async () => {
    serviceMock.listRuns.mockResolvedValue([])

    await controller.listRuns('tenant-1', 'marketing_performance')

    expect(serviceMock.listRuns).toHaveBeenCalledWith('tenant-1', 'marketing_performance')
  })

  it('allows internal list by explicit organization id', async () => {
    serviceMock.listRuns.mockResolvedValue([])

    await controller.listRunsInternal('tenant-2', 'sales_pipeline')

    expect(serviceMock.listRuns).toHaveBeenCalledWith('tenant-2', 'sales_pipeline')
  })
})
