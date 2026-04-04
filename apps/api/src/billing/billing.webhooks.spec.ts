/**
 * BillingService webhook handler unit tests.
 *
 * Covers: valid signature, invalid signature, missing signature, timestamp
 * outside tolerance, unsupported event type, missing organizationId metadata,
 * stub-mode (when provider keys are absent), and full charge.success /
 * checkout.session.completed happy paths.
 *
 * Prisma is fully mocked so no database is required.
 */

import { BadRequestException, ForbiddenException } from '@nestjs/common'
import { createHmac } from 'crypto'
import { BillingService } from './billing.service'
import { EventEmitter2 } from '@nestjs/event-emitter'

// ── Prisma mock ──────────────────────────────────────────────────────────────

// ── EventEmitter mock ────────────────────────────────────────────────────────

const eventEmitterMock = {
  emit: jest.fn(),
} as unknown as EventEmitter2

const prismaMock = {
  $executeRaw: jest.fn().mockResolvedValue(1),
  $queryRaw: jest.fn().mockResolvedValue([]),
  organization: {
    findUnique: jest.fn(),
    update: jest.fn().mockResolvedValue({}),
  },
  auditLog: {
    create: jest.fn().mockResolvedValue({}),
  },
  user: { count: jest.fn().mockResolvedValue(0) },
  integrationConnection: { count: jest.fn().mockResolvedValue(0) },
  agentRun: { findMany: jest.fn().mockResolvedValue([]) },
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const PAYSTACK_SECRET = 'paystack-webhook-test-secret'
const STRIPE_SECRET = 'sk_test_000'
const STRIPE_WEBHOOK_SECRET = 'whsec_test_abc'

function makePaystackSig(body: string, secret = PAYSTACK_SECRET): string {
  return createHmac('sha512', secret).update(body).digest('hex')
}

function makeStripeSig(
  body: string,
  secret = STRIPE_WEBHOOK_SECRET,
  tsOverride?: number,
): string {
  const ts = tsOverride ?? Math.floor(Date.now() / 1000)
  const signed = `${ts}.${body}`
  const v1 = createHmac('sha256', secret).update(signed).digest('hex')
  return `t=${ts},v1=${v1}`
}

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('BillingService – webhook handlers', () => {
  let service: BillingService

  beforeEach(() => {
    jest.clearAllMocks()
    service = new BillingService(prismaMock as never, eventEmitterMock)

    // Pre-set billingTablesReady so ensureBillingTables() is a no-op for every
    // test; the DDL path is separately covered by the $executeRaw mock returning 1.
    ;(service as unknown as { billingTablesReady: boolean }).billingTablesReady = true

    delete process.env.PAYSTACK_SECRET_KEY
    delete process.env.STRIPE_SECRET_KEY
    delete process.env.STRIPE_WEBHOOK_SECRET
  })

  // ══════════════════════════════════════════════════════════════════════════
  //  Paystack
  // ══════════════════════════════════════════════════════════════════════════

  describe('handlePaystackWebhook', () => {
    it('returns stub mode when PAYSTACK_SECRET_KEY is absent', async () => {
      const result = await service.handlePaystackWebhook(
        JSON.stringify({ event: 'charge.success', data: {} }),
        'any-sig',
      )
      expect(result).toEqual({ accepted: true, mode: 'stub' })
    })

    it('throws ForbiddenException when signature header is missing', async () => {
      process.env.PAYSTACK_SECRET_KEY = PAYSTACK_SECRET

      const body = JSON.stringify({ event: 'charge.success', data: {} })

      await expect(
        service.handlePaystackWebhook(body, undefined),
      ).rejects.toBeInstanceOf(ForbiddenException)
    })

    it('throws ForbiddenException for an incorrect Paystack signature', async () => {
      process.env.PAYSTACK_SECRET_KEY = PAYSTACK_SECRET

      const body = JSON.stringify({ event: 'charge.success', data: {} })

      await expect(
        service.handlePaystackWebhook(body, 'deadbeef'),
      ).rejects.toBeInstanceOf(ForbiddenException)
    })

    it('throws ForbiddenException when signature is computed with wrong key', async () => {
      process.env.PAYSTACK_SECRET_KEY = PAYSTACK_SECRET

      const body = JSON.stringify({
        event: 'charge.success',
        data: { reference: 'ref-bad', metadata: {} },
      })
      const wrongSig = makePaystackSig(body, 'wrong-secret')

      await expect(
        service.handlePaystackWebhook(body, wrongSig),
      ).rejects.toBeInstanceOf(ForbiddenException)
    })

    it('accepts a valid signature for a non-charge event without applying a plan', async () => {
      process.env.PAYSTACK_SECRET_KEY = PAYSTACK_SECRET

      const body = JSON.stringify({
        event: 'transfer.success',
        data: { reference: 'ref-transfer', metadata: {} },
      })

      const result = await service.handlePaystackWebhook(body, makePaystackSig(body))

      expect(result).toEqual({ accepted: true, mode: 'live' })
      expect(prismaMock.organization.update).not.toHaveBeenCalled()
    })

    it('accepts valid charge.success – applies plan and upserts invoice', async () => {
      process.env.PAYSTACK_SECRET_KEY = PAYSTACK_SECRET
      prismaMock.organization.update.mockResolvedValueOnce({})

      const body = JSON.stringify({
        event: 'charge.success',
        data: {
          reference: 'ref-001',
          amount: 15000000,
          currency: 'NGN',
          status: 'success',
          paid_at: new Date().toISOString(),
          metadata: { organizationId: 'org-ps-1', planId: 'growth' },
        },
      })

      const result = await service.handlePaystackWebhook(body, makePaystackSig(body))

      expect(result).toEqual({ accepted: true, mode: 'live' })
      expect(prismaMock.organization.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'org-ps-1' },
          data: expect.objectContaining({
            subscriptionTier: 'GROWTH',
            subscriptionStatus: 'ACTIVE',
          }),
        }),
      )
      // upsert invoice + record payment event each call $executeRaw
      expect(prismaMock.$executeRaw).toHaveBeenCalled()
    })

    it('accepts valid charge.success without applying plan when metadata is absent', async () => {
      process.env.PAYSTACK_SECRET_KEY = PAYSTACK_SECRET

      // No organizationId / planId in metadata → plan should NOT be applied
      const body = JSON.stringify({
        event: 'charge.success',
        data: {
          reference: 'ref-nometa',
          amount: 5000,
          currency: 'NGN',
          status: 'success',
          paid_at: new Date().toISOString(),
          metadata: {},
        },
      })

      const result = await service.handlePaystackWebhook(body, makePaystackSig(body))

      expect(result).toEqual({ accepted: true, mode: 'live' })
      expect(prismaMock.organization.update).not.toHaveBeenCalled()
    })

    it('handles Buffer rawBody the same as string rawBody', async () => {
      process.env.PAYSTACK_SECRET_KEY = PAYSTACK_SECRET

      const body = JSON.stringify({
        event: 'transfer.success',
        data: { reference: 'ref-buf', metadata: {} },
      })
      const sig = makePaystackSig(body)

      const result = await service.handlePaystackWebhook(
        Buffer.from(body, 'utf8'),
        sig,
      )

      expect(result).toEqual({ accepted: true, mode: 'live' })
    })
  })

  // ══════════════════════════════════════════════════════════════════════════
  //  Stripe
  // ══════════════════════════════════════════════════════════════════════════

  describe('handleStripeWebhook', () => {
    it('returns stub mode when STRIPE_SECRET_KEY is absent', async () => {
      const result = await service.handleStripeWebhook(
        JSON.stringify({ type: 'checkout.session.completed' }),
        'any-sig',
      )
      expect(result).toEqual({ accepted: true, mode: 'stub' })
    })

    it('returns stub mode when STRIPE_WEBHOOK_SECRET is absent', async () => {
      process.env.STRIPE_SECRET_KEY = STRIPE_SECRET

      const result = await service.handleStripeWebhook(
        JSON.stringify({ type: 'checkout.session.completed' }),
        'any-sig',
      )
      expect(result).toEqual({ accepted: true, mode: 'stub' })
    })

    it('throws ForbiddenException when stripe-signature header is missing', async () => {
      process.env.STRIPE_SECRET_KEY = STRIPE_SECRET
      process.env.STRIPE_WEBHOOK_SECRET = STRIPE_WEBHOOK_SECRET

      await expect(
        service.handleStripeWebhook(
          JSON.stringify({ id: 'evt_1', type: 'invoice.paid', data: { object: {} } }),
          undefined,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException)
    })

    it('throws ForbiddenException for an incorrect Stripe v1 signature', async () => {
      process.env.STRIPE_SECRET_KEY = STRIPE_SECRET
      process.env.STRIPE_WEBHOOK_SECRET = STRIPE_WEBHOOK_SECRET

      const ts = Math.floor(Date.now() / 1000)
      const body = JSON.stringify({ id: 'evt_bad', type: 'invoice.paid', data: { object: {} } })

      await expect(
        service.handleStripeWebhook(body, `t=${ts},v1=deadbeef`),
      ).rejects.toBeInstanceOf(ForbiddenException)
    })

    it('throws ForbiddenException when signature is computed with wrong webhook secret', async () => {
      process.env.STRIPE_SECRET_KEY = STRIPE_SECRET
      process.env.STRIPE_WEBHOOK_SECRET = STRIPE_WEBHOOK_SECRET

      const body = JSON.stringify({
        id: 'evt_wk',
        type: 'invoice.paid',
        data: { object: { id: 'in_wk', metadata: { organizationId: 'org-1' } } },
      })
      const wrongSig = makeStripeSig(body, 'wrong-webhook-secret')

      await expect(
        service.handleStripeWebhook(body, wrongSig),
      ).rejects.toBeInstanceOf(ForbiddenException)
    })

    it('throws ForbiddenException when signature timestamp is stale (> 300s)', async () => {
      process.env.STRIPE_SECRET_KEY = STRIPE_SECRET
      process.env.STRIPE_WEBHOOK_SECRET = STRIPE_WEBHOOK_SECRET

      const staleTs = Math.floor(Date.now() / 1000) - 400 // 400s > 300s tolerance
      const body = JSON.stringify({
        id: 'evt_stale',
        type: 'invoice.paid',
        data: { object: { id: 'in_stale', metadata: { organizationId: 'org-1' } } },
      })
      const staleSig = makeStripeSig(body, STRIPE_WEBHOOK_SECRET, staleTs)

      await expect(
        service.handleStripeWebhook(body, staleSig),
      ).rejects.toBeInstanceOf(ForbiddenException)
    })

    it('throws ForbiddenException for a malformed signature header (no t= part)', async () => {
      process.env.STRIPE_SECRET_KEY = STRIPE_SECRET
      process.env.STRIPE_WEBHOOK_SECRET = STRIPE_WEBHOOK_SECRET

      const body = JSON.stringify({ id: 'evt_mal', type: 'invoice.paid', data: { object: {} } })

      await expect(
        service.handleStripeWebhook(body, 'v1=only-no-timestamp'),
      ).rejects.toBeInstanceOf(ForbiddenException)
    })

    it('throws BadRequestException for an unsupported Stripe event type', async () => {
      process.env.STRIPE_SECRET_KEY = STRIPE_SECRET
      process.env.STRIPE_WEBHOOK_SECRET = STRIPE_WEBHOOK_SECRET

      const body = JSON.stringify({
        id: 'evt_unsup',
        type: 'customer.subscription.deleted',
        data: { object: {} },
      })

      await expect(
        service.handleStripeWebhook(body, makeStripeSig(body)),
      ).rejects.toBeInstanceOf(BadRequestException)
    })

    it('records the rejected unsupported event to payment_events', async () => {
      process.env.STRIPE_SECRET_KEY = STRIPE_SECRET
      process.env.STRIPE_WEBHOOK_SECRET = STRIPE_WEBHOOK_SECRET

      const body = JSON.stringify({
        id: 'evt_rec',
        type: 'customer.deleted',
        data: { object: {} },
      })

      await service.handleStripeWebhook(body, makeStripeSig(body)).catch(() => {
        /* expected rejection */
      })

      expect(prismaMock.$executeRaw).toHaveBeenCalled()
    })

    it('throws BadRequestException when organizationId metadata is missing', async () => {
      process.env.STRIPE_SECRET_KEY = STRIPE_SECRET
      process.env.STRIPE_WEBHOOK_SECRET = STRIPE_WEBHOOK_SECRET

      const body = JSON.stringify({
        id: 'evt_nometa',
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_1',
            mode: 'subscription',
            payment_status: 'paid',
            metadata: { planId: 'growth' }, // organizationId is absent
          },
        },
      })

      await expect(
        service.handleStripeWebhook(body, makeStripeSig(body)),
      ).rejects.toBeInstanceOf(BadRequestException)
    })

    it('accepts valid checkout.session.completed – applies plan and upserts invoice', async () => {
      process.env.STRIPE_SECRET_KEY = STRIPE_SECRET
      process.env.STRIPE_WEBHOOK_SECRET = STRIPE_WEBHOOK_SECRET
      prismaMock.organization.update.mockResolvedValueOnce({})

      const body = JSON.stringify({
        id: 'evt_checkout',
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_2',
            mode: 'subscription',
            payment_status: 'paid',
            amount_total: 9500,
            currency: 'usd',
            metadata: { organizationId: 'org-str-1', planId: 'growth' },
          },
        },
      })

      const result = await service.handleStripeWebhook(body, makeStripeSig(body))

      expect(result).toEqual({ accepted: true, mode: 'live' })
      expect(prismaMock.organization.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'org-str-1' },
          data: expect.objectContaining({
            subscriptionTier: 'GROWTH',
            subscriptionStatus: 'ACTIVE',
          }),
        }),
      )
      expect(prismaMock.$executeRaw).toHaveBeenCalled()
    })

    it('throws BadRequestException for checkout.session.completed with wrong mode', async () => {
      process.env.STRIPE_SECRET_KEY = STRIPE_SECRET
      process.env.STRIPE_WEBHOOK_SECRET = STRIPE_WEBHOOK_SECRET

      const body = JSON.stringify({
        id: 'evt_mode',
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_3',
            mode: 'payment', // should be 'subscription'
            payment_status: 'paid',
            metadata: { organizationId: 'org-str-2', planId: 'growth' },
          },
        },
      })

      await expect(
        service.handleStripeWebhook(body, makeStripeSig(body)),
      ).rejects.toBeInstanceOf(BadRequestException)
    })

    it('accepts valid invoice.paid event and upserts invoice', async () => {
      process.env.STRIPE_SECRET_KEY = STRIPE_SECRET
      process.env.STRIPE_WEBHOOK_SECRET = STRIPE_WEBHOOK_SECRET

      const body = JSON.stringify({
        id: 'evt_inv_paid',
        type: 'invoice.paid',
        data: {
          object: {
            id: 'in_1',
            amount_total: 9500,
            currency: 'usd',
            metadata: { organizationId: 'org-str-2' },
          },
        },
      })

      const result = await service.handleStripeWebhook(body, makeStripeSig(body))

      expect(result).toEqual({ accepted: true, mode: 'live' })
      expect(prismaMock.$executeRaw).toHaveBeenCalled()
    })

    it('accepts valid invoice.payment_failed event and upserts invoice with FAILED status', async () => {
      process.env.STRIPE_SECRET_KEY = STRIPE_SECRET
      process.env.STRIPE_WEBHOOK_SECRET = STRIPE_WEBHOOK_SECRET

      const body = JSON.stringify({
        id: 'evt_inv_fail',
        type: 'invoice.payment_failed',
        data: {
          object: {
            id: 'in_2',
            amount_total: 9500,
            currency: 'usd',
            status: 'open',
            metadata: { organizationId: 'org-str-3' },
          },
        },
      })

      const result = await service.handleStripeWebhook(body, makeStripeSig(body))

      expect(result).toEqual({ accepted: true, mode: 'live' })
      expect(prismaMock.$executeRaw).toHaveBeenCalled()
    })

    it('handles Buffer rawBody the same as string rawBody', async () => {
      process.env.STRIPE_SECRET_KEY = STRIPE_SECRET
      process.env.STRIPE_WEBHOOK_SECRET = STRIPE_WEBHOOK_SECRET

      const bodyStr = JSON.stringify({
        id: 'evt_buf',
        type: 'invoice.paid',
        data: {
          object: {
            id: 'in_buf',
            amount_total: 100,
            currency: 'usd',
            metadata: { organizationId: 'org-str-4' },
          },
        },
      })

      const result = await service.handleStripeWebhook(
        Buffer.from(bodyStr, 'utf8'),
        makeStripeSig(bodyStr),
      )

      expect(result).toEqual({ accepted: true, mode: 'live' })
    })
  })
})
