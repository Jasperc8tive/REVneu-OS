import { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { createHmac } from 'crypto'
import request = require('supertest')
import Stripe from 'stripe'
import { IntegrationWebhooksController } from './webhooks.controller'

jest.mock('stripe', () => {
  const StripeMock = jest.fn().mockImplementation(() => ({
    webhooks: {
      constructEvent: jest.fn(() => ({ id: 'evt_test' })),
    },
  }))

  return {
    __esModule: true,
    default: StripeMock,
  }
})

describe('IntegrationWebhooksController (runtime checks)', () => {
  let app: INestApplication

  beforeEach(async () => {
    jest.clearAllMocks()

    const moduleRef = await Test.createTestingModule({
      controllers: [IntegrationWebhooksController],
    }).compile()

    app = moduleRef.createNestApplication()
    app.setGlobalPrefix('api/v1', {
      exclude: ['health'],
    })
    await app.init()
  })

  afterEach(async () => {
    await app.close()
    delete process.env.PAYSTACK_WEBHOOK_SECRET
    delete process.env.STRIPE_SECRET_KEY
    delete process.env.STRIPE_WEBHOOK_SECRET
  })

  it('accepts valid Paystack webhook signature over HTTP', async () => {
    process.env.PAYSTACK_WEBHOOK_SECRET = 'paystack-secret'

    const body = { event: 'charge.success', data: { amount: 5000 } }
    const payload = JSON.stringify(body)
    const signature = createHmac('sha512', process.env.PAYSTACK_WEBHOOK_SECRET)
      .update(payload)
      .digest('hex')

    await request(app.getHttpServer())
      .post('/api/v1/integrations/webhooks/paystack')
      .set('x-paystack-signature', signature)
      .send(body)
      .expect(200)
  })

  it('rejects invalid Paystack webhook signature over HTTP', async () => {
    process.env.PAYSTACK_WEBHOOK_SECRET = 'paystack-secret'

    await request(app.getHttpServer())
      .post('/api/v1/integrations/webhooks/paystack')
      .set('x-paystack-signature', 'deadbeef')
      .send({ event: 'charge.success' })
      .expect(401)
  })

  it('accepts Stripe webhook when signature validates', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_123'
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_123'

    await request(app.getHttpServer())
      .post('/api/v1/integrations/webhooks/stripe')
      .set('stripe-signature', 't=1,v1=ok')
      .send({ id: 'evt_1' })
      .expect(200)
  })

  it('rejects Stripe webhook on signature validation error', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_123'
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_123'

    ;(Stripe as unknown as jest.Mock).mockImplementationOnce(() => ({
      webhooks: {
        constructEvent: jest.fn(() => {
          throw new Error('invalid signature')
        }),
      },
    }))

    await request(app.getHttpServer())
      .post('/api/v1/integrations/webhooks/stripe')
      .set('stripe-signature', 't=1,v1=bad')
      .send({ id: 'evt_1' })
      .expect(401)
  })
})
