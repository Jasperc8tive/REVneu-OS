import axios from 'axios'
import { AgentSchedulerService } from './agent-scheduler.service'

jest.mock('axios')

describe('AgentSchedulerService', () => {
  const prismaMock = {
    organization: {
      findMany: jest.fn(),
    },
    agentSchedule: {
      findMany: jest.fn(),
      createMany: jest.fn(),
      update: jest.fn(),
    },
    agentRun: {
      findFirst: jest.fn(),
    },
  }

  let service: AgentSchedulerService

  beforeEach(() => {
    jest.clearAllMocks()
    service = new AgentSchedulerService(prismaMock as never)
    process.env.AGENT_SCHEDULER_ENABLED = 'true'
    process.env.AGENT_API_KEY = 'strong-agent-key-1234567890'
    process.env.AGENT_SERVICE_URL = 'http://localhost:8000'
  })

  it('seeds schedules and triggers due run-all for eligible orgs', async () => {
    prismaMock.organization.findMany.mockResolvedValue([{ id: 'org-1' }])
    prismaMock.agentSchedule.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: 'sched-1',
          organizationId: 'org-1',
          cadenceMinutes: 60,
          lastTriggeredAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
        },
      ])

    prismaMock.agentSchedule.createMany.mockResolvedValue({ count: 1 })
    prismaMock.agentRun.findFirst.mockResolvedValue(null)
    ;(axios.post as jest.Mock).mockResolvedValue({ data: { count: 7 } })

    await service.scheduleDueAgentRuns()

    expect(prismaMock.agentSchedule.createMany).toHaveBeenCalled()
    expect(axios.post).toHaveBeenCalledWith(
      'http://localhost:8000/api/v1/agents/run-all',
      expect.objectContaining({ tenant_id: 'org-1' }),
      expect.objectContaining({
        headers: { 'x-agent-api-key': 'strong-agent-key-1234567890' },
        timeout: 60000,
      }),
    )
    expect(prismaMock.agentSchedule.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'sched-1' },
        data: expect.objectContaining({
          lastRunStatus: 'SUCCESS',
        }),
      }),
    )
  })
})
