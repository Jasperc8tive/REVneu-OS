import { Injectable, Logger } from '@nestjs/common'
import axios from 'axios'
import { PrismaService } from '@revneu/database'
import { IntegrationObservabilityService } from '../common/services/integration-observability.service'
import { ConnectorsService } from '../connectors/connectors.service'
import { MetricsService } from '../metrics/metrics.service'
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto'

type IntegrationSource =
  | 'GA4'
  | 'META_ADS'
  | 'GOOGLE_ADS'
  | 'HUBSPOT'
  | 'PAYSTACK'
  | 'STRIPE'
  | 'SHOPIFY'
  | 'FLUTTERWAVE'
  | 'TIKTOK_ADS'
  | 'SALESFORCE'

@Injectable()
export class PipelineService {
  private readonly logger = new Logger(PipelineService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly connectorsService: ConnectorsService,
    private readonly metricsService: MetricsService,
    private readonly observability: IntegrationObservabilityService,
  ) {}

  async runSyncRun(syncRunId: string): Promise<void> {
    const syncRun = await this.prisma.integrationSyncRun.findUnique({
      where: { id: syncRunId },
      include: {
        integration: true,
      },
    })

    if (!syncRun) {
      this.logger.warn(`Sync run not found: ${syncRunId}`)
      return
    }

    try {
      await this.prisma.integrationSyncRun.update({
        where: { id: syncRunId },
        data: { status: 'RUNNING', startedAt: new Date() },
      })

      let credentials = this.decryptCredentials(syncRun.integration.encryptedCredentials)
      credentials = await this.refreshGoogleCredentialsIfNeeded(
        syncRun.integration.id,
        syncRun.integration.source,
        credentials,
      )

      const rawRecords = await this.connectorsService.fetchRawMetrics(syncRun.integration.source, credentials)

      const ingested = await this.metricsService.ingestRecords(
        syncRun.organizationId,
        syncRun.integration.source,
        rawRecords,
        syncRun.integrationId,
      )

      await this.prisma.integrationSyncRun.update({
        where: { id: syncRunId },
        data: {
          status: 'SUCCESS',
          finishedAt: new Date(),
          recordsIngested: ingested,
          errorMessage: null,
        },
      })

      await this.prisma.integrationConnection.update({
        where: { id: syncRun.integrationId },
        data: {
          status: 'ACTIVE',
          lastSyncAt: new Date(),
          errorCount: 0,
          healthScore: 100,
        },
      })

      this.observability.recordSyncOutcome('SUCCESS')
    } catch (error) {
      const retryCount = syncRun.retryCount + 1
      const terminalFailure = retryCount >= 3
      const nextRetryAt = new Date(Date.now() + Math.pow(2, retryCount) * 60 * 1000)
      const message = error instanceof Error ? error.message : 'Unknown sync failure'
      const reauthRequired = this.shouldMarkNeedsReauth(message)
      const nextErrorCount = (syncRun.integration.errorCount ?? 0) + 1

      await this.prisma.integrationSyncRun.update({
        where: { id: syncRunId },
        data: {
          status: terminalFailure ? 'DEAD_LETTER' : 'FAILED',
          finishedAt: new Date(),
          retryCount,
          nextRetryAt: terminalFailure ? null : nextRetryAt,
          errorMessage: message,
        },
      })

      await this.prisma.integrationConnection.update({
        where: { id: syncRun.integrationId },
        data: {
          status: reauthRequired ? 'NEEDS_REAUTH' : 'ERROR',
          errorCount: { increment: 1 },
          healthScore: { decrement: 10 },
        },
      })

      this.observability.recordSyncOutcome(terminalFailure ? 'DEAD_LETTER' : 'FAILED')

      if (reauthRequired) {
        const threshold = this.getReauthAlertThreshold()
        if (nextErrorCount >= threshold) {
          this.observability.recordNeedsReauthAlert({
            organizationId: syncRun.organizationId,
            integrationId: syncRun.integrationId,
            source: syncRun.integration.source,
            errorCount: nextErrorCount,
            threshold,
          })
        }
      }

      this.logger.error(`Sync run ${syncRunId} failed: ${message}`)
      if (terminalFailure) {
        return
      }

      throw error
    }
  }

  private getCryptoKey(): Buffer {
    const keyMaterial = process.env.INTEGRATION_CREDENTIALS_KEY ?? 'stage3-dev-fallback-key'
    return createHash('sha256').update(keyMaterial).digest()
  }

  private encryptCredentials(credentials: Record<string, unknown>): string {
    const iv = randomBytes(16)
    const key = this.getCryptoKey()
    const cipher = createCipheriv('aes-256-gcm', key, iv)
    const plaintext = JSON.stringify(credentials)

    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
    const tag = cipher.getAuthTag()

    return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`
  }

  private decryptCredentials(encryptedPayload: string): Record<string, unknown> {
    const [ivHex, tagHex, encryptedHex] = encryptedPayload.split(':')
    const iv = Buffer.from(ivHex, 'hex')
    const tag = Buffer.from(tagHex, 'hex')
    const encrypted = Buffer.from(encryptedHex, 'hex')

    const decipher = createDecipheriv('aes-256-gcm', this.getCryptoKey(), iv)
    decipher.setAuthTag(tag)

    const plaintext = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')
    return JSON.parse(plaintext) as Record<string, unknown>
  }

  private async refreshGoogleCredentialsIfNeeded(
    integrationId: string,
    source: IntegrationSource,
    credentials: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    if (source !== 'GA4' && source !== 'GOOGLE_ADS') {
      return credentials
    }

    const refreshToken = credentials.refresh_token
    if (typeof refreshToken !== 'string' || refreshToken.length === 0) {
      return credentials
    }

    const accessToken = credentials.access_token
    const expiresAtRaw = credentials.expires_at
    const expiresAtMs = typeof expiresAtRaw === 'string' ? Date.parse(expiresAtRaw) : NaN

    const shouldRefresh =
      typeof accessToken !== 'string' || accessToken.length === 0 || !Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now() + 60_000

    if (!shouldRefresh) {
      return credentials
    }

    this.observability.recordTokenRefreshAttempt(source, 'attempt')

    let tokenResponse: Record<string, unknown>
    try {
      tokenResponse = await this.refreshGoogleToken(source, refreshToken)
    } catch (error) {
      this.observability.recordTokenRefreshAttempt(source, 'failure')
      throw error
    }

    const refreshedAccessToken = tokenResponse.access_token

    if (typeof refreshedAccessToken !== 'string' || refreshedAccessToken.length === 0) {
      this.observability.recordTokenRefreshAttempt(source, 'failure')
      return credentials
    }

    const expiresInRaw = tokenResponse.expires_in
    const expiresIn = typeof expiresInRaw === 'number' ? expiresInRaw : Number(expiresInRaw ?? 3600)

    const updatedCredentials: Record<string, unknown> = {
      ...credentials,
      ...tokenResponse,
      access_token: refreshedAccessToken,
      refresh_token: tokenResponse.refresh_token ?? refreshToken,
      expires_at: Number.isFinite(expiresIn) && expiresIn > 0
        ? new Date(Date.now() + expiresIn * 1000).toISOString()
        : credentials.expires_at,
      refreshed_at: new Date().toISOString(),
    }

    await this.prisma.integrationConnection.update({
      where: { id: integrationId },
      data: {
        encryptedCredentials: this.encryptCredentials(updatedCredentials),
      },
    })

    this.observability.recordTokenRefreshAttempt(source, 'success')

    return updatedCredentials
  }

  private shouldMarkNeedsReauth(message: string): boolean {
    const normalized = message.toLowerCase()
    return normalized.includes('invalid_grant')
      || normalized.includes('invalid refresh token')
      || normalized.includes('token revoked')
      || normalized.includes('reauth')
  }

  private getReauthAlertThreshold(): number {
    const rawThreshold = Number(process.env.REAUTH_ALERT_THRESHOLD ?? 3)
    if (!Number.isFinite(rawThreshold)) {
      return 3
    }

    return Math.max(1, Math.floor(rawThreshold))
  }

  private async refreshGoogleToken(
    source: 'GA4' | 'GOOGLE_ADS',
    refreshToken: string,
  ): Promise<Record<string, unknown>> {
    const clientId = source === 'GOOGLE_ADS'
      ? (process.env.GOOGLE_ADS_CLIENT_ID ?? process.env.GA4_CLIENT_ID)
      : process.env.GA4_CLIENT_ID
    const clientSecret = source === 'GOOGLE_ADS'
      ? (process.env.GOOGLE_ADS_CLIENT_SECRET ?? process.env.GA4_CLIENT_SECRET)
      : process.env.GA4_CLIENT_SECRET

    if (!clientId || !clientSecret) {
      throw new Error(`${source} OAuth client credentials are missing`)
    }

    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    })

    const response = await axios.post('https://oauth2.googleapis.com/token', body.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      timeout: 12_000,
    })

    return response.data as Record<string, unknown>
  }
}
