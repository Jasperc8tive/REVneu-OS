import axios from 'axios'
import { ConnectorsService } from './connectors.service'

jest.mock('axios')

describe('ConnectorsService', () => {
  const mockedAxios = axios as jest.Mocked<typeof axios>
  let service: ConnectorsService

  beforeEach(() => {
    jest.clearAllMocks()
    service = new ConnectorsService()
  })

  it('pulls and normalizes Paystack metrics using API key auth', async () => {
    mockedAxios.get.mockResolvedValueOnce({
      data: {
        data: [
          { status: 'success', amount: 12500 },
          { status: 'success', amount: 7500 },
          { status: 'failed', amount: 1000 },
        ],
      },
    })

    const records = await service.fetchRawMetrics('PAYSTACK', { apiKey: 'paystack_sk_live' })

    expect(mockedAxios.get).toHaveBeenCalledWith(
      'https://api.paystack.co/transaction',
      expect.objectContaining({
        headers: { Authorization: 'Bearer paystack_sk_live' },
      }),
    )

    expect(records).toHaveLength(2)

    const revenue = records.find((record) => record.metricType === 'REVENUE')
    const conversions = records.find((record) => record.metricType === 'CONVERSIONS')

    expect(revenue?.value).toBe(200)
    expect(revenue?.currency).toBe('NGN')
    expect(conversions?.value).toBe(2)
  })

  it('pulls and normalizes HubSpot metrics using API key auth', async () => {
    mockedAxios.get.mockResolvedValueOnce({
      data: {
        results: [
          {
            properties: {
              amount: '1200.5',
              dealstage: 'closedwon',
            },
          },
          {
            properties: {
              amount: '99.5',
              dealstage: 'appointmentscheduled',
            },
          },
          {
            properties: {
              amount: '800',
              dealstage: 'closedwon',
            },
          },
        ],
      },
    })

    const records = await service.fetchRawMetrics('HUBSPOT', { apiKey: 'hubspot_pat' })

    expect(mockedAxios.get).toHaveBeenCalledWith(
      'https://api.hubapi.com/crm/v3/objects/deals',
      expect.objectContaining({
        headers: { Authorization: 'Bearer hubspot_pat' },
      }),
    )

    expect(records).toHaveLength(2)

    const revenue = records.find((record) => record.metricType === 'REVENUE')
    const conversions = records.find((record) => record.metricType === 'CONVERSIONS')

    expect(revenue?.value).toBeCloseTo(2000.5)
    expect(conversions?.value).toBe(2)
  })
})
