/**
 * BillingController webhook routes – HTTP integration tests.
 *
 * Spins up a real NestJS application with BillingService mocked.
 * Verifies correct URL paths, header extraction (x-paystack-signature /
 * stripe-signature), and exception-to-HTTP-status mapping for every
 * scenario the service can surface.
 */

import {
  BadRequestException,
  ForbiddenException,
  INestApplication,
} from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { createHmac } from 'crypto'
import request = require('supertest')
import { BillingController } from './billing.controller'
import { BillingService } from './billing.service'

// ── Service mock ─────────────────────────────────────────────────────────────

const billingServiceMock = {
  handlePaystackWebhook: jest.fn(),
  handleStripeWebhook: jest.fn(),
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const PAYSTACK_SECRET = 'paystack-e2e-secret'
const STRIPE_WEBHOOK_SECRET = 'whsec_e2e_abc'

function makePaystackSig(body: string): string {
  return createHmac('sha512', PAYSTACK_SECRET).update(body).digest('hex')
}

function makeStripeSig(body: string): string {
  const ts = Math.floor(Date.now() / 1000)
  const signed = `${ts}.${body}`
  const v1 = createHmac('sha256', STRIPE_WEBHOOK_SECRET).update(signed).digest('hex')
  return `t=${ts},v1=${v1}`
}

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('BillingController – webhook routes (HTTP)', () => {
  let app: INestApplication

  beforeEach(async () => {
    jest.clearAllMocks()

    const moduleRef = await Test.createTestingModule({
      controllers: [BillingController],
      providers: [{ provide: BillingService, useValue: billingServiceMock }],
    }).compile()

    app = moduleRef.createNestApplication()
    app.setGlobalPrefix('api/v1', { exclude: ['health'] })
    await app.init()
  })

  afterEach(async () => {
    await app.close()
  })

  // ══════════════════════════════════════════════════════════════════════════
  //  POST /api/v1/billing/webhooks/paystack
  // ══════════════════════════════════════════════════════════════════════════

  describe('POST /api/v1/billing/webhooks/paystack', () => {
    const ENDPOINT = '/api/v1/billing/webhooks/paystack'

    it('returns 200 and forwards x-paystack-signature to the service', async () => {
      billingServiceMock.handlePaystackWebhook.mockResolvedValue({
        accepted: true,
        mode: 'live',
      })

      const body = { event: 'charge.success', data: { reference: 'ref-1' } }
      const bodyStr = JSON.stringify(body)
      const sig = makePaystackSig(bodyStr)

      const response = await request(app.getHttpServer())
        .post(ENDPOINT)
        .set('x-paystack-signature', sig)
        .send(body)
        .expect(200)

      expect(response.body).toEqual({ accepted: true, mode: 'live' })
      expect(billingServiceMock.handlePaystackWebhook).toHaveBeenCalledWith(
        expect.anything(),
        sig,
      )
    })

    it('returns 200 in stub mode when service returns stub', async () => {
      billingServiceMock.handlePaystackWebhook.mockResolvedValue({
        accepted: true,
        mode: 'stub',
      })

      await request(app.getHttpServer())
        .post(ENDPOINT)
        .send({ event: 'charge.success' })
        .expect(200)
    })

    it('returns 403 when service throws ForbiddenException (invalid signature)', async () => {
      billingServiceMock.handlePaystackWebhook.mockRejectedValue(
        new ForbiddenException('Invalid Paystack signature'),
      )

      await request(app.getHttpServer())
        .post(ENDPOINT)
        .set('x-paystack-signature', 'bad-sig')
        .send({ event: 'charge.success' })
        .expect(403)
    })

    it('returns 403 when service throws ForbiddenException (missing signature)', async () => {
      billingServiceMock.handlePaystackWebhook.mockRejectedValue(
        new ForbiddenException('Invalid Paystack signature'),
      )

      await request(app.getHttpServer())
        .post(ENDPOINT)
        .send({ event: 'charge.success' })
        .expect(403)
    })

    it('returns 400 when service throws BadRequestException', async () => {
      billingServiceMock.handlePaystackWebhook.mockRejectedValue(
        new BadRequestException('Invalid payload'),
      )

      await request(app.getHttpServer())
        .post(ENDPOINT)
        .set('x-paystack-signature', makePaystackSig('{}'))
        .send({})
        .expect(400)
    })
  })

  // ══════════════════════════════════════════════════════════════════════════
  //  POST /api/v1/billing/webhooks/stripe
  // ══════════════════════════════════════════════════════════════════════════

  describe('POST /api/v1/billing/webhooks/stripe', () => {
    const ENDPOINT = '/api/v1/billing/webhooks/stripe'

    it('returns 200 and forwards stripe-signature header to the service', async () => {
      billingServiceMock.handleStripeWebhook.mockResolvedValue({
        accepted: true,
        mode: 'live',
      })

      const body = {
        id: 'evt_1',
        type: 'checkout.session.completed',
        data: { object: {} },
      }
      const bodyStr = JSON.stringify(body)
      const sig = makeStripeSig(bodyStr)

      const response = await request(app.getHttpServer())
        .post(ENDPOINT)
        .set('stripe-signature', sig)
        .send(body)
        .expect(200)

      expect(response.body).toEqual({ accepted: true, mode: 'live' })
      expect(billingServiceMock.handleStripeWebhook).toHaveBeenCalledWith(
        expect.anything(),
        sig,
      )
    })

    it('returns 200 in stub mode when service returns stub', async () => {
      billingServiceMock.handleStripeWebhook.mockResolvedValue({
        accepted: true,
        mode: 'stub',
      })

      await request(app.getHttpServer())
        .post(ENDPOINT)
        .send({ id: 'evt_stub', type: 'checkout.session.completed' })
        .expect(200)
    })

    it('returns 403 when service throws ForbiddenException (invalid signature)', async () => {
      billingServiceMock.handleStripeWebhook.mockRejectedValue(
        new ForbiddenException('Invalid Stripe signature'),
      )

      await request(app.getHttpServer())
        .post(ENDPOINT)
        .set('stripe-signature', 'bad-sig')
        .send({ id: 'evt_2', type: 'checkout.session.completed', data: {} })
        .expect(403)
    })

    it('returns 403 when service throws ForbiddenException (missing signature)', async () => {
      billingServiceMock.handleStripeWebhook.mockRejectedValue(
        new ForbiddenException('Missing Stripe signature'),
      )

      await request(app.getHttpServer())
        .post(ENDPOINT)
        .send({ id: 'evt_3', type: 'invoice.paid', data: {} })
        .expect(403)
    })

    it('returns 403 when service throws ForbiddenException (stale timestamp)', async () => {
      billingServiceMock.handleStripeWebhook.mockRejectedValue(
        new ForbiddenException('Stripe signature timestamp outside tolerance'),
      )

      const staleTs = Math.floor(Date.now() / 1000) - 400
      const body = { id: 'evt_stale', type: 'invoice.paid', data: {} }
      const staleSig = `t=${staleTs},v1=stalevalue`

      await request(app.getHttpServer())
        .post(ENDPOINT)
        .set('stripe-signature', staleSig)
        .send(body)
        .expect(403)
    })

    it('returns 400 when service throws BadRequestException (unsupported event type)', async () => {
      billingServiceMock.handleStripeWebhook.mockRejectedValue(
        new BadRequestException('Unsupported Stripe event type'),
      )

      const body = {
        id: 'evt_4',
        type: 'customer.subscription.deleted',
        data: { object: {} },
      }
      const bodyStr = JSON.stringify(body)

      await request(app.getHttpServer())
        .post(ENDPOINT)
        .set('stripe-signature', makeStripeSig(bodyStr))
        .send(body)
        .expect(400)
    })

    it('returns 400 when service throws BadRequestException (missing organizationId)', async () => {
      billingServiceMock.handleStripeWebhook.mockRejectedValue(
        new BadRequestException('Missing required metadata organizationId'),
      )

      const body = {
        id: 'evt_5',
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_5',
            mode: 'subscription',
            payment_status: 'paid',
            metadata: { planId: 'growth' },
          },
        },
      }
      const bodyStr = JSON.stringify(body)

      await request(app.getHttpServer())
        .post(ENDPOINT)
        .set('stripe-signature', makeStripeSig(bodyStr))
        .send(body)
        .expect(400)
    })

    it('returns 400 when service throws BadRequestException (invalid checkout payload)', async () => {
      billingServiceMock.handleStripeWebhook.mockRejectedValue(
        new BadRequestException('Invalid checkout.session.completed payload'),
      )

      const body = {
        id: 'evt_6',
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_6',
            mode: 'payment', // wrong mode
            payment_status: 'paid',
            metadata: { organizationId: 'org-1', planId: 'growth' },
          },
        },
      }
      const bodyStr = JSON.stringify(body)

      await request(app.getHttpServer())
        .post(ENDPOINT)
        .set('stripe-signature', makeStripeSig(bodyStr))
        .send(body)
        .expect(400)
    })
  })
})
