import type { ExecutionContext, INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request = require('supertest')
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { IntegrationsController } from './integrations.controller'
import { IntegrationsService } from './integrations.service'

describe('IntegrationsController (runtime checks)', () => {
  let app: INestApplication

  const integrationsServiceMock = {
    getOAuthStartUrl: jest.fn(),
    completeOAuthCallback: jest.fn(),
  }

  beforeEach(async () => {
    jest.clearAllMocks()
    process.env.FRONTEND_URL = 'http://localhost:3000'

    const moduleRef = await Test.createTestingModule({
      controllers: [IntegrationsController],
      providers: [
        {
          provide: IntegrationsService,
          useValue: integrationsServiceMock,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          const req = context.switchToHttp().getRequest()
          req.user = {
            sub: 'user-1',
            organizationId: 'org-1',
            role: 'OWNER',
            email: 'owner@example.com',
          }
          return true
        },
      })
      .overrideGuard(RolesGuard)
      .useValue({
        canActivate: () => true,
      })
      .compile()

    app = moduleRef.createNestApplication()
    await app.init()
  })

  afterEach(async () => {
    await app.close()
  })

  it('GA4 OAuth start returns provider URL', async () => {
    integrationsServiceMock.getOAuthStartUrl.mockResolvedValue({
      url: 'https://accounts.google.com/o/oauth2/v2/auth?source=GA4',
    })

    const response = await request(app.getHttpServer())
      .get('/api/v1/integrations/oauth/GA4/start')
      .query({ displayName: 'GA4 Main', syncIntervalMinutes: '30' })
      .expect(200)

    expect(response.body).toEqual({
      url: 'https://accounts.google.com/o/oauth2/v2/auth?source=GA4',
    })

    expect(integrationsServiceMock.getOAuthStartUrl).toHaveBeenCalledWith(
      'org-1',
      'user-1',
      'GA4',
      'GA4 Main',
      30,
    )
  })

  it('Meta OAuth start returns provider URL', async () => {
    integrationsServiceMock.getOAuthStartUrl.mockResolvedValue({
      url: 'https://www.facebook.com/v19.0/dialog/oauth?source=META_ADS',
    })

    const response = await request(app.getHttpServer())
      .get('/api/v1/integrations/oauth/META_ADS/start')
      .query({ displayName: 'Meta Main', syncIntervalMinutes: '60' })
      .expect(200)

    expect(response.body).toEqual({
      url: 'https://www.facebook.com/v19.0/dialog/oauth?source=META_ADS',
    })

    expect(integrationsServiceMock.getOAuthStartUrl).toHaveBeenCalledWith(
      'org-1',
      'user-1',
      'META_ADS',
      'Meta Main',
      60,
    )
  })

  it('OAuth callback redirects with connected state on success', async () => {
    integrationsServiceMock.completeOAuthCallback.mockResolvedValue({ connected: true })

    const response = await request(app.getHttpServer())
      .get('/api/v1/integrations/oauth/GA4/callback')
      .query({ code: 'code-1', state: 'signed-state' })
      .expect(302)

    expect(response.headers.location).toBe('http://localhost:3000/integrations?oauth=connected&source=GA4')
    expect(integrationsServiceMock.completeOAuthCallback).toHaveBeenCalledWith('GA4', 'code-1', 'signed-state')
  })

  it('OAuth callback redirects with failed state on provider failure', async () => {
    integrationsServiceMock.completeOAuthCallback.mockRejectedValue(new Error('oauth_failed'))

    const response = await request(app.getHttpServer())
      .get('/api/v1/integrations/oauth/META_ADS/callback')
      .query({ code: 'bad-code', state: 'signed-state' })
      .expect(302)

    expect(response.headers.location).toBe('http://localhost:3000/integrations?oauth=failed&source=META_ADS')
  })
})
