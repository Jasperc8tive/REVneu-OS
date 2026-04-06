import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '@revneu/database'
import axios from 'axios'
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto'
import { BillingService } from '../billing/billing.service'
import { SyncQueueService } from '../workers/sync.queue.service'
import { CreateIntegrationDto } from './dto/create-integration.dto'

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

interface OAuthStatePayload {
  organizationId: string
  userId: string
  displayName: string
  source: 'GA4' | 'META_ADS' | 'GOOGLE_ADS'
  syncIntervalMinutes: number
  nonce: string
  issuedAt: number
}

@Injectable()
export class IntegrationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly billingService: BillingService,
    private readonly syncQueueService: SyncQueueService,
  ) {}

  async listIntegrations(organizationId: string) {
    return this.prisma.integrationConnection.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        source: true,
        authType: true,
        displayName: true,
        status: true,
        syncIntervalMinutes: true,
        lastSyncAt: true,
        errorCount: true,
        healthScore: true,
        createdAt: true,
        updatedAt: true,
      },
    })
  }

  async createIntegration(
    organizationId: string,
    userId: string,
    dto: CreateIntegrationDto,
  ) {
    await this.billingService.assertWithinLimit(organizationId, 'integrations')

    const encryptedCredentials = this.encryptCredentials(dto.credentials)

    return this.prisma.integrationConnection.create({
      data: {
        organizationId,
        source: dto.source,
        authType: dto.authType,
        displayName: dto.displayName,
        encryptedCredentials,
        syncIntervalMinutes: dto.syncIntervalMinutes ?? 60,
        createdByUserId: userId,
      },
      select: {
        id: true,
        source: true,
        authType: true,
        displayName: true,
        status: true,
        createdAt: true,
      },
    })
  }

  async disconnectIntegration(organizationId: string, integrationId: string) {
    const integration = await this.prisma.integrationConnection.findUnique({
      where: { id: integrationId },
      select: { id: true, organizationId: true },
    })

    if (!integration || integration.organizationId !== organizationId) {
      throw new NotFoundException('Integration not found')
    }

    await this.prisma.integrationConnection.update({
      where: { id: integrationId },
      data: { status: 'DISCONNECTED' },
    })

    return { success: true }
  }

  async triggerSync(organizationId: string, integrationId: string) {
    const integration = await this.prisma.integrationConnection.findUnique({
      where: { id: integrationId },
      select: { id: true, organizationId: true, status: true },
    })

    if (!integration || integration.organizationId !== organizationId) {
      throw new NotFoundException('Integration not found')
    }

    if (integration.status === 'DISCONNECTED') {
      throw new BadRequestException('Cannot sync a disconnected integration')
    }

    const syncRun = await this.prisma.integrationSyncRun.create({
      data: {
        organizationId,
        integrationId,
        status: 'QUEUED',
      },
    })

    await this.syncQueueService.enqueueSyncRun(syncRun.id)

    return { syncRunId: syncRun.id, status: syncRun.status }
  }

  async integrationHealth(organizationId: string, integrationId: string) {
    const integration = await this.prisma.integrationConnection.findUnique({
      where: { id: integrationId },
      include: {
        syncRuns: {
          orderBy: { startedAt: 'desc' },
          take: 10,
          select: {
            id: true,
            status: true,
            startedAt: true,
            finishedAt: true,
            retryCount: true,
            recordsIngested: true,
            errorMessage: true,
          },
        },
      },
    })

    if (!integration || integration.organizationId !== organizationId) {
      throw new NotFoundException('Integration not found')
    }

    return {
      id: integration.id,
      source: integration.source,
      status: integration.status,
      errorCount: integration.errorCount,
      healthScore: integration.healthScore,
      lastSyncAt: integration.lastSyncAt,
      recentSyncRuns: integration.syncRuns,
    }
  }

  async syncHistory(organizationId: string, integrationId: string) {
    const integration = await this.prisma.integrationConnection.findUnique({
      where: { id: integrationId },
      select: { organizationId: true },
    })

    if (!integration || integration.organizationId !== organizationId) {
      throw new NotFoundException('Integration not found')
    }

    return this.prisma.integrationSyncRun.findMany({
      where: { organizationId, integrationId },
      orderBy: { startedAt: 'desc' },
      take: 30,
      select: {
        id: true,
        status: true,
        startedAt: true,
        finishedAt: true,
        retryCount: true,
        recordsIngested: true,
        errorMessage: true,
      },
    })
  }

  async getOAuthStartUrl(
    organizationId: string,
    userId: string,
    source: 'GA4' | 'META_ADS' | 'GOOGLE_ADS',
    displayName?: string,
    syncIntervalMinutes: number = 60,
  ) {
    const statePayload: OAuthStatePayload = {
      organizationId,
      userId,
      displayName: displayName || source,
      source,
      syncIntervalMinutes,
      nonce: randomBytes(12).toString('hex'),
      issuedAt: Date.now(),
    }

    const state = this.createSignedState(statePayload)
    const redirectUri = this.getOAuthRedirectUri(source)

    if (source === 'GA4' || source === 'GOOGLE_ADS') {
      const clientId = source === 'GOOGLE_ADS'
        ? (process.env.GOOGLE_ADS_CLIENT_ID ?? process.env.GA4_CLIENT_ID)
        : process.env.GA4_CLIENT_ID
      if (!clientId) {
        throw new BadRequestException(`${source} OAuth is not configured`)
      }

      const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
      url.searchParams.set('client_id', clientId)
      url.searchParams.set('redirect_uri', redirectUri)
      url.searchParams.set('response_type', 'code')
      url.searchParams.set(
        'scope',
        source === 'GOOGLE_ADS'
          ? 'https://www.googleapis.com/auth/adwords'
          : 'https://www.googleapis.com/auth/analytics.readonly',
      )
      url.searchParams.set('access_type', 'offline')
      url.searchParams.set('prompt', 'consent')
      url.searchParams.set('state', state)

      return { url: url.toString() }
    }

    const appId = process.env.META_APP_ID
    if (!appId) {
      throw new BadRequestException('Meta OAuth is not configured')
    }

    const url = new URL('https://www.facebook.com/v19.0/dialog/oauth')
    url.searchParams.set('client_id', appId)
    url.searchParams.set('redirect_uri', redirectUri)
    url.searchParams.set('response_type', 'code')
    url.searchParams.set('scope', 'ads_read,business_management')
    url.searchParams.set('state', state)

    return { url: url.toString() }
  }

  async completeOAuthCallback(source: 'GA4' | 'META_ADS' | 'GOOGLE_ADS', code: string, state: string) {
    const payload = this.verifySignedState(state)

    if (payload.source !== source) {
      throw new BadRequestException('OAuth state/source mismatch')
    }

    if (Date.now() - payload.issuedAt > 10 * 60 * 1000) {
      throw new BadRequestException('OAuth state expired')
    }

    const redirectUri = this.getOAuthRedirectUri(source)
    const tokenData = await this.exchangeOAuthCode(source, code, redirectUri)
    const normalizedCredentials = {
      ...tokenData,
      connectedAt: new Date().toISOString(),
    } as Record<string, unknown>

    if (source === 'GA4' || source === 'GOOGLE_ADS') {
      const expiresInRaw = tokenData.expires_in
      const expiresIn = typeof expiresInRaw === 'number'
        ? expiresInRaw
        : Number(expiresInRaw ?? 3600)
      if (Number.isFinite(expiresIn) && expiresIn > 0) {
        normalizedCredentials.expires_at = new Date(Date.now() + expiresIn * 1000).toISOString()
      }
    }

    const encryptedCredentials = this.encryptCredentials(normalizedCredentials)

    await this.prisma.integrationConnection.upsert({
      where: {
        organizationId_source_displayName: {
          organizationId: payload.organizationId,
          source,
          displayName: payload.displayName,
        },
      },
      update: {
        encryptedCredentials,
        status: 'ACTIVE',
        syncIntervalMinutes: payload.syncIntervalMinutes,
        errorCount: 0,
        healthScore: 100,
      },
      create: {
        organizationId: payload.organizationId,
        source,
        authType: 'OAUTH',
        displayName: payload.displayName,
        encryptedCredentials,
        syncIntervalMinutes: payload.syncIntervalMinutes,
        createdByUserId: payload.userId,
      },
    })

    return {
      organizationId: payload.organizationId,
      source,
      connected: true,
    }
  }

  async getDecryptedCredentials(
    organizationId: string,
    integrationId: string,
  ): Promise<{ source: IntegrationSource; credentials: Record<string, unknown> }> {
    const integration = await this.prisma.integrationConnection.findUnique({
      where: { id: integrationId },
      select: {
        organizationId: true,
        source: true,
        encryptedCredentials: true,
      },
    })

    if (!integration || integration.organizationId !== organizationId) {
      throw new NotFoundException('Integration not found')
    }

    return {
      source: integration.source,
      credentials: this.decryptCredentials(integration.encryptedCredentials),
    }
  }

  private getCryptoKey(): Buffer {
    const keyMaterial = process.env.INTEGRATION_CREDENTIALS_KEY ?? 'stage3-dev-fallback-key'
    return createHash('sha256').update(keyMaterial).digest()
  }

  private getStateSigningKey(): string {
    return process.env.INTEGRATION_OAUTH_STATE_SECRET ?? 'stage3-oauth-state-secret'
  }

  private getOAuthRedirectUri(source: 'GA4' | 'META_ADS' | 'GOOGLE_ADS'): string {
    const base = process.env.API_BASE_URL ?? 'http://localhost:4000'
    return `${base}/api/v1/integrations/oauth/${source}/callback`
  }

  private createSignedState(payload: OAuthStatePayload): string {
    const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url')
    const signature = createHash('sha256')
      .update(`${encoded}:${this.getStateSigningKey()}`)
      .digest('hex')
    return `${encoded}.${signature}`
  }

  private verifySignedState(state: string): OAuthStatePayload {
    const [encoded, signature] = state.split('.')
    if (!encoded || !signature) {
      throw new BadRequestException('Invalid OAuth state')
    }

    const expected = createHash('sha256')
      .update(`${encoded}:${this.getStateSigningKey()}`)
      .digest('hex')

    if (expected !== signature) {
      throw new BadRequestException('Invalid OAuth state signature')
    }

    return JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as OAuthStatePayload
  }

  private async exchangeOAuthCode(
    source: 'GA4' | 'META_ADS' | 'GOOGLE_ADS',
    code: string,
    redirectUri: string,
  ): Promise<Record<string, unknown>> {
    if (source === 'GA4' || source === 'GOOGLE_ADS') {
      const clientId = source === 'GOOGLE_ADS'
        ? (process.env.GOOGLE_ADS_CLIENT_ID ?? process.env.GA4_CLIENT_ID)
        : process.env.GA4_CLIENT_ID
      const clientSecret = source === 'GOOGLE_ADS'
        ? (process.env.GOOGLE_ADS_CLIENT_SECRET ?? process.env.GA4_CLIENT_SECRET)
        : process.env.GA4_CLIENT_SECRET
      if (!clientId || !clientSecret) {
        throw new BadRequestException(`${source} OAuth credentials are missing`)
      }

      const body = new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      })

      const tokenResponse = await axios.post(
        'https://oauth2.googleapis.com/token',
        body.toString(),
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        },
      )

      return tokenResponse.data as Record<string, unknown>
    }

    const appId = process.env.META_APP_ID
    const appSecret = process.env.META_APP_SECRET
    if (!appId || !appSecret) {
      throw new BadRequestException('Meta OAuth credentials are missing')
    }

    const tokenResponse = await axios.get('https://graph.facebook.com/v19.0/oauth/access_token', {
      params: {
        client_id: appId,
        client_secret: appSecret,
        redirect_uri: redirectUri,
        code,
      },
    })

    return tokenResponse.data as Record<string, unknown>
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
}
