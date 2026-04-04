import { RecommendationsController } from './recommendations.controller'

describe('RecommendationsController', () => {
  const serviceMock = {
    listRecommendations: jest.fn(),
    createRecommendation: jest.fn(),
  }

  let controller: RecommendationsController

  beforeEach(() => {
    jest.clearAllMocks()
    controller = new RecommendationsController(serviceMock as never)
  })

  it('uses tenant id from auth context for public list endpoint', async () => {
    serviceMock.listRecommendations.mockResolvedValue([])

    await controller.listRecommendations('tenant-1', 'marketing_performance')

    expect(serviceMock.listRecommendations).toHaveBeenCalledWith('tenant-1', 'marketing_performance')
  })

  it('allows internal list by explicit organization id', async () => {
    serviceMock.listRecommendations.mockResolvedValue([])

    await controller.listRecommendationsInternal('tenant-2', 'sales_pipeline')

    expect(serviceMock.listRecommendations).toHaveBeenCalledWith('tenant-2', 'sales_pipeline')
  })
})
