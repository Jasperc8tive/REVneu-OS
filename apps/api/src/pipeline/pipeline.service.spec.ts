import { PipelineService } from './pipeline.service'

describe('PipelineService', () => {
  const prismaMock = {
    integrationSyncRun: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    integrationConnection: {
      update: jest.fn(),
    },
  }

  const connectorsServiceMock = {
    fetchRawMetrics: jest.fn(),
  }

  const metricsServiceMock = {
    ingestRecords: jest.fn(),
  }

  const observabilityMock = {
    recordSyncOutcome: jest.fn(),
    recordTokenRefreshAttempt: jest.fn(),
    recordNeedsReauthAlert: jest.fn(),
  }

  let service: PipelineService

  beforeEach(() => {
    jest.clearAllMocks()
    delete process.env.REAUTH_ALERT_THRESHOLD

    service = new PipelineService(
      prismaMock as never,
      connectorsServiceMock as never,
      metricsServiceMock as never,
      observabilityMock as never,
    )
  })

  const getPrivateApi = (instance: PipelineService) => instance as unknown as {
    decryptCredentials: (encryptedPayload: string) => Record<string, unknown>
    refreshGoogleToken: (
      source: 'GA4' | 'GOOGLE_ADS',
      refreshToken: string,
    ) => Promise<Record<string, unknown>>
    encryptCredentials: (credentials: Record<string, unknown>) => string
  }

  it('refreshes expired Google credentials and persists rotated token before ingestion', async () => {
    prismaMock.integrationSyncRun.findUnique.mockResolvedValue({
      id: 'sync-1',
      organizationId: 'org-1',
      integrationId: 'int-1',
      retryCount: 0,
      integration: {
        id: 'int-1',
        source: 'GOOGLE_ADS',
        encryptedCredentials: 'encrypted-old',
        errorCount: 0,
      },
    })

    prismaMock.integrationSyncRun.update.mockResolvedValue(undefined)
    prismaMock.integrationConnection.update.mockResolvedValue(undefined)

    connectorsServiceMock.fetchRawMetrics.mockResolvedValue([])
    metricsServiceMock.ingestRecords.mockResolvedValue(3)

    const privateApi = getPrivateApi(service)

    const decryptSpy = jest.spyOn(privateApi, 'decryptCredentials').mockReturnValue({
      access_token: 'expired-access-token',
      refresh_token: 'refresh-token-1',
      expires_at: new Date(Date.now() - 60_000).toISOString(),
    })

    const refreshSpy = jest.spyOn(privateApi, 'refreshGoogleToken').mockResolvedValue({
      access_token: 'fresh-access-token',
      refresh_token: 'refresh-token-2',
      expires_in: 3600,
    })

    const encryptSpy = jest.spyOn(privateApi, 'encryptCredentials').mockReturnValue('encrypted-new')

    await service.runSyncRun('sync-1')

    expect(decryptSpy).toHaveBeenCalledWith('encrypted-old')
    expect(refreshSpy).toHaveBeenCalledWith('GOOGLE_ADS', 'refresh-token-1')
    expect(encryptSpy).toHaveBeenCalled()

    expect(prismaMock.integrationConnection.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'int-1' },
        data: expect.objectContaining({
          encryptedCredentials: 'encrypted-new',
        }),
      }),
    )

    expect(connectorsServiceMock.fetchRawMetrics).toHaveBeenCalledWith(
      'GOOGLE_ADS',
      expect.objectContaining({
        access_token: 'fresh-access-token',
        refresh_token: 'refresh-token-2',
      }),
    )

    expect(prismaMock.integrationSyncRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'sync-1' },
        data: expect.objectContaining({
          status: 'SUCCESS',
          recordsIngested: 3,
        }),
      }),
    )

    expect(observabilityMock.recordTokenRefreshAttempt).toHaveBeenCalledWith('GOOGLE_ADS', 'attempt')
    expect(observabilityMock.recordTokenRefreshAttempt).toHaveBeenCalledWith('GOOGLE_ADS', 'success')
    expect(observabilityMock.recordSyncOutcome).toHaveBeenCalledWith('SUCCESS')
  })

  it('marks sync as failed and bubbles error when refresh token call fails', async () => {
    process.env.REAUTH_ALERT_THRESHOLD = '1'

    prismaMock.integrationSyncRun.findUnique.mockResolvedValue({
      id: 'sync-2',
      organizationId: 'org-1',
      integrationId: 'int-2',
      retryCount: 0,
      integration: {
        id: 'int-2',
        source: 'GA4',
        encryptedCredentials: 'encrypted-old',
        errorCount: 0,
      },
    })

    prismaMock.integrationSyncRun.update.mockResolvedValue(undefined)
    prismaMock.integrationConnection.update.mockResolvedValue(undefined)

    const privateApi = getPrivateApi(service)

    jest.spyOn(privateApi, 'decryptCredentials').mockReturnValue({
      access_token: 'expired-access-token',
      refresh_token: 'refresh-token-1',
      expires_at: new Date(Date.now() - 60_000).toISOString(),
    })

    jest.spyOn(privateApi, 'refreshGoogleToken').mockRejectedValue(new Error('invalid_grant'))

    await expect(service.runSyncRun('sync-2')).rejects.toThrow('invalid_grant')

    expect(prismaMock.integrationSyncRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'sync-2' },
        data: expect.objectContaining({
          status: 'FAILED',
          errorMessage: 'invalid_grant',
        }),
      }),
    )

    expect(prismaMock.integrationConnection.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'int-2' },
        data: expect.objectContaining({
          status: 'NEEDS_REAUTH',
        }),
      }),
    )

    expect(observabilityMock.recordTokenRefreshAttempt).toHaveBeenCalledWith('GA4', 'attempt')
    expect(observabilityMock.recordTokenRefreshAttempt).toHaveBeenCalledWith('GA4', 'failure')
    expect(observabilityMock.recordSyncOutcome).toHaveBeenCalledWith('FAILED')
    expect(observabilityMock.recordNeedsReauthAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org-1',
        integrationId: 'int-2',
        source: 'GA4',
        errorCount: 1,
        threshold: 1,
      }),
    )
  })

  it('moves a terminally failing run to DEAD_LETTER and does not rethrow', async () => {
    prismaMock.integrationSyncRun.findUnique.mockResolvedValue({
      id: 'sync-3',
      organizationId: 'org-1',
      integrationId: 'int-3',
      retryCount: 2,
      integration: {
        id: 'int-3',
        source: 'PAYSTACK',
        encryptedCredentials: 'encrypted-old',
        errorCount: 2,
      },
    })

    prismaMock.integrationSyncRun.update.mockResolvedValue(undefined)
    prismaMock.integrationConnection.update.mockResolvedValue(undefined)

    const privateApi = getPrivateApi(service)
    jest.spyOn(privateApi, 'decryptCredentials').mockReturnValue({ apiKey: 'pk_test' })
    connectorsServiceMock.fetchRawMetrics.mockRejectedValue(new Error('upstream timeout'))

    await expect(service.runSyncRun('sync-3')).resolves.toBeUndefined()

    expect(prismaMock.integrationSyncRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'sync-3' },
        data: expect.objectContaining({
          status: 'DEAD_LETTER',
          retryCount: 3,
          errorMessage: 'upstream timeout',
        }),
      }),
    )

    expect(observabilityMock.recordSyncOutcome).toHaveBeenCalledWith('DEAD_LETTER')
  })
})
