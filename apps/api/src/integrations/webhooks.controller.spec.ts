import { BadRequestException, UnauthorizedException } from '@nestjs/common'
import { createHmac } from 'crypto'
import Stripe from 'stripe'
import { IntegrationWebhooksController } from './webhooks.controller'

jest.mock('stripe', () => {
  const StripeMock = jest.fn().mockImplementation(() => ({
    webhooks: {
      constructEvent: jest.fn(() => ({ id: 'evt_test_1' })),
    },
  }))

  return {
    __esModule: true,
    default: StripeMock,
  }
})

describe('IntegrationWebhooksController', () => {
  let controller: IntegrationWebhooksController

  beforeEach(() => {
    jest.clearAllMocks()
    controller = new IntegrationWebhooksController()

    delete process.env.PAYSTACK_WEBHOOK_SECRET
    delete process.env.STRIPE_SECRET_KEY
    delete process.env.STRIPE_WEBHOOK_SECRET
  })

  it('accepts valid Paystack signature', async () => {
    process.env.PAYSTACK_WEBHOOK_SECRET = 'paystack-secret'

    const payload = JSON.stringify({ event: 'charge.success', data: { amount: 1000 } })
    const signature = createHmac('sha512', process.env.PAYSTACK_WEBHOOK_SECRET)
      .update(payload)
      .digest('hex')

    const req = {
      rawBody: Buffer.from(payload, 'utf8'),
      body: {},
    }

    await expect(controller.paystackWebhook(req as never, signature)).resolves.toEqual({ received: true })
  })

  it('rejects invalid Paystack signature', async () => {
    process.env.PAYSTACK_WEBHOOK_SECRET = 'paystack-secret'

    const req = {
      rawBody: Buffer.from('{"event":"charge.success"}', 'utf8'),
      body: {},
    }

    await expect(controller.paystackWebhook(req as never, 'deadbeef')).rejects.toBeInstanceOf(UnauthorizedException)
  })

  it('throws when Paystack secret is missing', async () => {
    const req = {
      rawBody: Buffer.from('{}', 'utf8'),
      body: {},
    }

    await expect(controller.paystackWebhook(req as never, 'abcd')).rejects.toBeInstanceOf(BadRequestException)
  })

  it('accepts valid Stripe signature when constructEvent succeeds', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_123'
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_123'

    const req = {
      rawBody: Buffer.from('{"id":"evt_1"}', 'utf8'),
      body: {},
    }

    await expect(controller.stripeWebhook(req as never, 't=1,v1=test')).resolves.toEqual({ received: true })
  })

  it('rejects Stripe signature when constructEvent throws', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_123'
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_123'

    ;(Stripe as unknown as jest.Mock).mockImplementationOnce(() => ({
      webhooks: {
        constructEvent: jest.fn(() => {
          throw new Error('invalid signature')
        }),
      },
    }))

    const req = {
      rawBody: Buffer.from('{"id":"evt_1"}', 'utf8'),
      body: {},
    }

    await expect(controller.stripeWebhook(req as never, 't=1,v1=bad')).rejects.toBeInstanceOf(UnauthorizedException)
  })
})
