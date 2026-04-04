import { BadRequestException, ForbiddenException, Injectable, StreamableFile } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { PrismaService } from '@revneu/database'
import { createHmac, randomUUID, timingSafeEqual } from 'crypto'
import axios from 'axios'
import PDFDocument from 'pdfkit'

type Plan = {
  id: string
  name: string
  priceNgn: number
  priceUsd?: number
  maxUsers: number
  maxIntegrations: number
  maxAgents: number
  description: string
}

type TierLimits = {
  maxUsers: number
  maxIntegrations: number
  maxAgents: number
}

type FeatureName = 'users' | 'integrations' | 'agents'

type BillingInvoiceRow = {
  id: string
  organization_id: string
  provider: string
  provider_reference: string | null
  amount_minor: number
  currency: string
  status: string
  issued_at: Date
  paid_at: Date | null
}

const TIER_LIMITS: Record<string, TierLimits> = {
  TRIAL: { maxUsers: 10, maxIntegrations: 6, maxAgents: 5 },
  STARTER: { maxUsers: 3, maxIntegrations: 2, maxAgents: 2 },
  GROWTH: { maxUsers: 10, maxIntegrations: 6, maxAgents: 5 },
  SCALE: { maxUsers: 25, maxIntegrations: Number.MAX_SAFE_INTEGER, maxAgents: 7 },
  ENTERPRISE: {
    maxUsers: Number.MAX_SAFE_INTEGER,
    maxIntegrations: Number.MAX_SAFE_INTEGER,
    maxAgents: Number.MAX_SAFE_INTEGER,
  },
}

const STRIPE_ALLOWED_EVENTS = new Set([
  'checkout.session.completed',
  'invoice.paid',
  'invoice.payment_failed',
])

const STRIPE_TOLERANCE_SECONDS = 300

@Injectable()
export class BillingService {
  private billingTablesReady = false
  private graceTablesReady = false

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  getPlans(): Plan[] {
    return [
      {
        id: 'starter',
        name: 'Starter',
        priceNgn: 49000,
        priceUsd: 30,
        maxUsers: 3,
        maxIntegrations: 2,
        maxAgents: 2,
        description: 'For early-stage teams validating growth loops.',
      },
      {
        id: 'growth',
        name: 'Growth',
        priceNgn: 150000,
        priceUsd: 95,
        maxUsers: 10,
        maxIntegrations: 6,
        maxAgents: 5,
        description: 'For scaling teams running cross-channel optimization.',
      },
      {
        id: 'scale',
        name: 'Scale',
        priceNgn: 450000,
        priceUsd: 280,
        maxUsers: 25,
        maxIntegrations: 999,
        maxAgents: 7,
        description: 'For mature organizations with advanced automation.',
      },
    ]
  }

  async getSubscription(organizationId: string) {
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        id: true,
        subscriptionTier: true,
        subscriptionStatus: true,
        trialEndsAt: true,
      },
    })

    if (!organization) {
      return null
    }

    const tier = organization.subscriptionTier
    const planId = tier.toLowerCase()

    return {
      id: `sub_${organization.id}`,
      organizationId: organization.id,
      planId,
      planName: tier,
      status: organization.subscriptionStatus,
      currentPeriodStart: new Date().toISOString(),
      currentPeriodEnd:
        organization.trialEndsAt?.toISOString() ??
        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      billedAt: null,
      nextBillingDate: organization.trialEndsAt?.toISOString() ?? null,
      amountPaid: 0,
      currency: 'NGN',
    }
  }

  async getUsage(organizationId: string) {
    const [users, integrations, activeAgents] = await Promise.all([
      this.prisma.user.count({ where: { organizationId } }),
      this.prisma.integrationConnection.count({
        where: { organizationId, status: { not: 'DISCONNECTED' } },
      }),
      this.prisma.agentRun.findMany({
        where: { organizationId },
        select: { agentId: true },
        distinct: ['agentId'],
      }),
    ])

    return {
      users,
      integrations,
      agents: activeAgents.length,
    }
  }

  async getLimits(organizationId: string): Promise<TierLimits> {
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { subscriptionTier: true },
    })

    if (!organization) {
      throw new BadRequestException('Organization not found')
    }

    return TIER_LIMITS[organization.subscriptionTier] ?? TIER_LIMITS.TRIAL
  }

  async getFeatureGateSummary(organizationId: string) {
    const [limits, usage, organization] = await Promise.all([
      this.getLimits(organizationId),
      this.getUsage(organizationId),
      this.prisma.organization.findUnique({
        where: { id: organizationId },
        select: { subscriptionTier: true, subscriptionStatus: true },
      }),
    ])

    return {
      tier: organization?.subscriptionTier ?? 'TRIAL',
      status: organization?.subscriptionStatus ?? 'TRIAL',
      limits,
      usage,
    }
  }

  async assertWithinLimit(
    organizationId: string,
    feature: FeatureName,
    nextIncrement: number = 1,
  ) {
    const [limits, usage] = await Promise.all([
      this.getLimits(organizationId),
      this.getUsage(organizationId),
    ])

    const nextValue = usage[feature] + nextIncrement
    const maxAllowed =
      limits[
        `max${feature.charAt(0).toUpperCase()}${feature.slice(1)}` as
          | 'maxUsers'
          | 'maxIntegrations'
          | 'maxAgents'
      ]

    if (nextValue > maxAllowed) {
      throw new ForbiddenException(
        `Plan limit exceeded for ${feature}. Upgrade required.`,
      )
    }
  }

  async createPaystackCheckout(
    organizationId: string,
    dto: { planId: string; email: string; callbackUrl?: string },
  ) {
    await this.ensureBillingTables()

    const plan = this.getPlans().find((item) => item.id === dto.planId)
    if (!plan) {
      throw new BadRequestException('Invalid plan')
    }

    const secretKey = process.env.PAYSTACK_SECRET_KEY
    const callbackUrl =
      dto.callbackUrl ??
      `${process.env.FRONTEND_URL ?? 'http://localhost:3000'}/dashboard/billing`

    if (!secretKey) {
      const reference = `stub_paystack_${organizationId}_${Date.now()}`
      await this.recordPaymentEvent({
        organizationId,
        provider: 'paystack',
        eventType: 'checkout.stub_initialized',
        providerEventId: reference,
        payload: { planId: plan.id, email: dto.email },
        isValid: true,
      })

      return {
        provider: 'paystack',
        mode: 'stub',
        checkoutUrl: `${callbackUrl}?provider=paystack&mode=stub&plan=${plan.id}`,
        reference,
      }
    }

    const response = await axios.post<{
      data?: { authorization_url?: string; reference?: string }
    }>(
      'https://api.paystack.co/transaction/initialize',
      {
        email: dto.email,
        amount: plan.priceNgn * 100,
        callback_url: callbackUrl,
        metadata: {
          organizationId,
          planId: plan.id,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${secretKey}`,
          'Content-Type': 'application/json',
        },
      },
    )

    const reference = response.data.data?.reference ?? `paystack_${Date.now()}`

    await this.recordPaymentEvent({
      organizationId,
      provider: 'paystack',
      eventType: 'checkout.initialized',
      providerEventId: reference,
      payload: {
        planId: plan.id,
        email: dto.email,
        checkoutUrl: response.data.data?.authorization_url,
      },
      isValid: true,
    })

    return {
      provider: 'paystack',
      mode: 'live',
      checkoutUrl: response.data.data?.authorization_url,
      reference,
    }
  }

  async createStripeCheckout(
    organizationId: string,
    dto: { planId: string; email: string; callbackUrl?: string },
  ) {
    await this.ensureBillingTables()

    const plan = this.getPlans().find((item) => item.id === dto.planId)
    if (!plan) {
      throw new BadRequestException('Invalid plan')
    }

    const secretKey = process.env.STRIPE_SECRET_KEY
    const callbackUrl =
      dto.callbackUrl ??
      `${process.env.FRONTEND_URL ?? 'http://localhost:3000'}/dashboard/billing`

    if (!secretKey) {
      const reference = `stub_stripe_${organizationId}_${Date.now()}`
      await this.recordPaymentEvent({
        organizationId,
        provider: 'stripe',
        eventType: 'checkout.stub_initialized',
        providerEventId: reference,
        payload: { planId: plan.id, email: dto.email },
        isValid: true,
      })

      return {
        provider: 'stripe',
        mode: 'stub',
        checkoutUrl: `${callbackUrl}?provider=stripe&mode=stub&plan=${plan.id}`,
        reference,
      }
    }

    const params = new URLSearchParams({
      mode: 'subscription',
      'line_items[0][price_data][currency]': 'usd',
      'line_items[0][price_data][product_data][name]': `Revneu ${plan.name}`,
      'line_items[0][price_data][unit_amount]': String((plan.priceUsd ?? 0) * 100),
      'line_items[0][quantity]': '1',
      success_url: callbackUrl,
      cancel_url: callbackUrl,
      customer_email: dto.email,
      'metadata[organizationId]': organizationId,
      'metadata[planId]': plan.id,
    })

    const response = await axios.post<{ id?: string; url?: string }>(
      'https://api.stripe.com/v1/checkout/sessions',
      params.toString(),
      {
        headers: {
          Authorization: `Bearer ${secretKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      },
    )

    const reference = response.data.id ?? `stripe_${Date.now()}`

    await this.recordPaymentEvent({
      organizationId,
      provider: 'stripe',
      eventType: 'checkout.initialized',
      providerEventId: reference,
      payload: {
        planId: plan.id,
        email: dto.email,
        checkoutUrl: response.data.url,
      },
      isValid: true,
    })

    return {
      provider: 'stripe',
      mode: 'live',
      checkoutUrl: response.data.url,
      reference,
    }
  }

  async handlePaystackWebhook(rawBody: Buffer | string, signature?: string) {
    await this.ensureBillingTables()

    const secretKey = process.env.PAYSTACK_SECRET_KEY
    const bodyString =
      typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8')

    if (!secretKey) {
      return { accepted: true, mode: 'stub' }
    }

    const expected = createHmac('sha512', secretKey)
      .update(bodyString)
      .digest('hex')
    if (!signature || signature !== expected) {
      throw new ForbiddenException('Invalid Paystack signature')
    }

    const payload = JSON.parse(bodyString) as {
      event?: string
      data?: {
        reference?: string
        amount?: number
        paid_at?: string
        currency?: string
        status?: string
        metadata?: { organizationId?: string; planId?: string }
      }
    }

    const organizationId = payload.data?.metadata?.organizationId
    const planId = payload.data?.metadata?.planId

    await this.recordPaymentEvent({
      organizationId,
      provider: 'paystack',
      eventType: payload.event ?? 'unknown',
      providerEventId: payload.data?.reference,
      payload,
      isValid: true,
    })

    if (payload.event === 'charge.success' && organizationId && planId) {
      await this.applyPlanFromCheckout(organizationId, planId)
      await this.upsertInvoice({
        organizationId,
        provider: 'paystack',
        providerReference: payload.data?.reference ?? null,
        amountMinor: payload.data?.amount ?? 0,
        currency: (payload.data?.currency ?? 'NGN').toUpperCase(),
        status: (payload.data?.status ?? 'PAID').toUpperCase(),
        paidAt: payload.data?.paid_at ? new Date(payload.data.paid_at) : new Date(),
      })
    }

    if (payload.event === 'charge.failed' && organizationId) {
      await this.upsertInvoice({
        organizationId,
        provider: 'paystack',
        providerReference: payload.data?.reference ?? null,
        amountMinor: payload.data?.amount ?? 0,
        currency: (payload.data?.currency ?? 'NGN').toUpperCase(),
        status: 'FAILED',
        paidAt: null,
      })
      await this.applyPaymentFailure(organizationId, 'paystack', payload.data?.reference ?? null)
    }

    return { accepted: true, mode: 'live' }
  }

  async handleStripeWebhook(rawBody: Buffer | string, signature?: string) {
    await this.ensureBillingTables()

    const secretKey = process.env.STRIPE_SECRET_KEY
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
    const bodyString =
      typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8')

    if (!secretKey || !webhookSecret) {
      return { accepted: true, mode: 'stub' }
    }

    this.verifyStripeSignature(bodyString, signature, webhookSecret)

    const payload = JSON.parse(bodyString) as {
      id?: string
      type?: string
      data?: {
        object?: {
          id?: string
          mode?: string
          metadata?: { organizationId?: string; planId?: string }
          subscription?: string
          customer?: string
          amount_paid?: number
          amount_due?: number
          currency?: string
          status?: string
          lines?: { data?: Array<{ price?: { product?: string } }> }
          payment_intent?: string
        }
      }
    }

    const eventObject = payload.data?.object
    const organizationId = eventObject?.metadata?.organizationId
    const planId = eventObject?.metadata?.planId

    // Always record the raw event first so partial failures are auditable.
    await this.recordPaymentEvent({
      organizationId,
      provider: 'stripe',
      eventType: payload.type ?? 'unknown',
      providerEventId: payload.id ?? eventObject?.id ?? undefined,
      payload,
      isValid: true,
    })

    if (!STRIPE_ALLOWED_EVENTS.has(payload.type ?? '')) {
      throw new BadRequestException('Unsupported Stripe event type: ' + (payload.type ?? 'unknown'))
    }

    if (!organizationId) {
      throw new BadRequestException('Missing organizationId in Stripe event metadata')
    }

    if (payload.type === 'checkout.session.completed') {
      if (eventObject?.mode !== 'subscription') {
        throw new BadRequestException('checkout.session.completed must use subscription mode')
      }
      if (planId) {
        await this.applyPlanFromCheckout(organizationId, planId)
      }
    }

    if (payload.type === 'invoice.paid') {
      await this.upsertInvoice({
        organizationId,
        provider: 'stripe',
        providerReference:
          eventObject?.id ??
          eventObject?.payment_intent ??
          payload.id ??
          null,
        amountMinor: eventObject?.amount_paid ?? eventObject?.amount_due ?? 0,
        currency: (eventObject?.currency ?? 'usd').toUpperCase(),
        status: 'PAID',
        paidAt: new Date(),
      })
    }

    if (payload.type === 'invoice.payment_failed') {
      await this.upsertInvoice({
        organizationId,
        provider: 'stripe',
        providerReference:
          eventObject?.id ??
          eventObject?.payment_intent ??
          payload.id ??
          null,
        amountMinor: eventObject?.amount_due ?? 0,
        currency: (eventObject?.currency ?? 'usd').toUpperCase(),
        status: 'FAILED',
        paidAt: null,
      })
      await this.applyPaymentFailure(
        organizationId,
        'stripe',
        eventObject?.id ?? eventObject?.payment_intent ?? payload.id ?? null,
      )
    }

    return { accepted: true, mode: 'live' }
  }

  private verifyStripeSignature(
    rawBody: string,
    signatureHeader: string | undefined,
    webhookSecret: string,
  ) {
    if (!signatureHeader) {
      throw new ForbiddenException('Missing Stripe signature')
    }

    const parts = signatureHeader.split(',').map((part) => part.trim())
    const timestamp = parts.find((part) => part.startsWith('t='))?.slice(2)
    const signatures = parts
      .filter((part) => part.startsWith('v1='))
      .map((part) => part.slice(3))

    if (!timestamp || signatures.length === 0) {
      throw new ForbiddenException('Malformed Stripe signature header')
    }

    const ageSeconds = Math.abs(
      Math.floor(Date.now() / 1000) - Number(timestamp),
    )
    if (!Number.isFinite(ageSeconds) || ageSeconds > STRIPE_TOLERANCE_SECONDS) {
      throw new ForbiddenException('Stripe signature timestamp outside tolerance')
    }

    const signedPayload = `${timestamp}.${rawBody}`
    const expected = createHmac('sha256', webhookSecret)
      .update(signedPayload)
      .digest('hex')
    const expectedBuffer = Buffer.from(expected)

    const matched = signatures.some((signature) => {
      const candidate = Buffer.from(signature)
      if (candidate.length !== expectedBuffer.length) {
        return false
      }
      return timingSafeEqual(candidate, expectedBuffer)
    })

    if (!matched) {
      throw new ForbiddenException('Invalid Stripe signature')
    }
  }

  // ── Payment failure + grace period ─────────────────────────────────────────

  async applyPaymentFailure(
    organizationId: string,
    provider: 'stripe' | 'paystack',
    providerReference: string | null,
  ): Promise<void> {
    await this.ensureGraceTable()

    const GRACE_DAYS = 7
    const graceEndsAt = new Date(Date.now() + GRACE_DAYS * 24 * 60 * 60 * 1000)

    await this.prisma.organization.update({
      where: { id: organizationId },
      data: { subscriptionStatus: 'PAST_DUE' },
    })

    await this.prisma.$executeRaw`
      INSERT INTO billing_grace_periods (
        id,
        organization_id,
        provider,
        provider_reference,
        grace_ends_at,
        is_active
      ) VALUES (
        ${randomUUID()},
        ${organizationId},
        ${provider},
        ${providerReference},
        ${graceEndsAt},
        TRUE
      )
      ON CONFLICT (organization_id)
      DO UPDATE SET
        grace_ends_at = EXCLUDED.grace_ends_at,
        is_active = TRUE,
        provider = EXCLUDED.provider,
        provider_reference = EXCLUDED.provider_reference
    `

    await this.prisma.auditLog.create({
      data: {
        organizationId,
        action: 'billing.payment.failed',
        resourceType: 'subscription',
        resourceId: organizationId,
        changes: { provider, providerReference, graceEndsAt: graceEndsAt.toISOString() },
      },
    })

    this.eventEmitter.emit('billing.payment.failed', {
      organizationId,
      provider,
      providerReference,
      graceEndsAt: graceEndsAt.toISOString(),
    })
  }

  private async ensureGraceTable(): Promise<void> {
    if (this.graceTablesReady) {
      return
    }

    await this.prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS billing_grace_periods (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL UNIQUE,
        provider TEXT NOT NULL,
        provider_reference TEXT,
        grace_ends_at TIMESTAMPTZ NOT NULL,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `

    await this.prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS idx_billing_grace_periods_active
      ON billing_grace_periods (grace_ends_at)
      WHERE is_active = TRUE
    `

    this.graceTablesReady = true
  }

  // ── Invoice PDF ─────────────────────────────────────────────────────────────

  async generateInvoicePdf(invoiceId: string, organizationId: string): Promise<StreamableFile> {
    await this.ensureBillingTables()

    const rows = await this.prisma.$queryRaw<BillingInvoiceRow[]>`
      SELECT id, organization_id, provider, provider_reference,
             amount_minor, currency, status, issued_at, paid_at
      FROM billing_invoices
      WHERE id = ${invoiceId}
        AND organization_id = ${organizationId}
      LIMIT 1
    `

    const invoice = rows[0]
    if (!invoice) {
      throw new BadRequestException('Invoice not found')
    }

    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { name: true, createdAt: true },
    })

    const amountDisplay = this.mapInvoiceAmount(Number(invoice.amount_minor), invoice.currency)
    const formattedAmount = new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: invoice.currency,
      minimumFractionDigits: 2,
    }).format(amountDisplay)

    const issuedDate = invoice.issued_at.toLocaleDateString('en-NG', {
      day: '2-digit', month: 'long', year: 'numeric',
    })
    const paidDate = invoice.paid_at
      ? invoice.paid_at.toLocaleDateString('en-NG', {
          day: '2-digit', month: 'long', year: 'numeric',
        })
      : '\u2014'

    const doc = new PDFDocument({ margin: 50, size: 'A4' })
    const chunks: Buffer[] = []

    doc.on('data', (chunk: Buffer) => chunks.push(chunk))

    const pdfReady = new Promise<Buffer>((resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)))
      doc.on('error', reject)
    })

    doc.fontSize(22).font('Helvetica-Bold').text('REVneu Technologies Ltd', 50, 50)
    doc.fontSize(10).font('Helvetica')
      .text('RC: 7654321 | VAT: 12345678-0001', { align: 'left' })
      .text('14 Bisi Ogabi Street, Victoria Island, Lagos, Nigeria', { align: 'left' })
      .text('support@revneu.com | +234 800 REVNEU', { align: 'left' })

    doc.moveDown(1.5)
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke()
    doc.moveDown(1)

    const metaTop = doc.y
    doc.fontSize(24).font('Helvetica-Bold').text('INVOICE', 50, metaTop)
    doc.fontSize(10).font('Helvetica')
      .text('Invoice #: ' + invoice.id.slice(0, 18).toUpperCase(), 350, metaTop, { align: 'right', width: 195 })
      .text('Issued: ' + issuedDate, 350, doc.y, { align: 'right', width: 195 })
      .text('Paid: ' + paidDate, 350, doc.y, { align: 'right', width: 195 })
      .text('Status: ' + invoice.status, 350, doc.y, { align: 'right', width: 195 })
      .text('Provider: ' + invoice.provider.toUpperCase(), 350, doc.y, { align: 'right', width: 195 })

    doc.moveDown(2)

    doc.fontSize(11).font('Helvetica-Bold').text('Bill To', 50)
    doc.fontSize(10).font('Helvetica')
      .text(org?.name ?? organizationId)
      .text('Organisation ID: ' + organizationId)

    doc.moveDown(1.5)

    const tableTop = doc.y
    doc.font('Helvetica-Bold').fontSize(10)
    doc.fillColor('#1a1a2e')
    doc.rect(50, tableTop, 495, 22).fill()
    doc.fillColor('white')
      .text('Description', 58, tableTop + 6)
      .text('Amount', 450, tableTop + 6, { width: 90, align: 'right' })

    const rowY = tableTop + 28
    doc.fillColor('black').font('Helvetica').fontSize(10)
    doc.rect(50, tableTop + 22, 495, 24).fillAndStroke('#f5f5f5', '#e0e0e0')
    doc.fillColor('black')
      .text('REVneu subscription (' + invoice.provider + ')', 58, rowY)
      .text(formattedAmount, 450, rowY, { width: 90, align: 'right' })

    doc.moveDown(4)

    const totalY = tableTop + 60
    doc.moveTo(350, totalY).lineTo(545, totalY).stroke()
    doc.font('Helvetica-Bold').fontSize(12)
      .text('Total', 350, totalY + 6, { width: 90 })
      .text(formattedAmount, 450, totalY + 6, { width: 90, align: 'right' })

    doc.moveDown(3)

    doc.fontSize(9).font('Helvetica').fillColor('#666666')
      .text(
        'This is a computer-generated invoice and requires no signature. ' +
        'For queries, contact support@revneu.com.',
        50, 720, { width: 495, align: 'center' },
      )

    doc.end()

    const buffer = await pdfReady
    return new StreamableFile(buffer, {
      type: 'application/pdf',
      disposition: 'attachment; filename="invoice-' + invoice.id.slice(0, 8) + '.pdf"',
    })
  }

  private async ensureBillingTables() {
    if (this.billingTablesReady) {
      return
    }

    await this.prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS billing_invoices (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        provider TEXT NOT NULL,
        provider_reference TEXT,
        amount_minor INTEGER NOT NULL DEFAULT 0,
        currency TEXT NOT NULL DEFAULT 'NGN',
        status TEXT NOT NULL,
        issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        paid_at TIMESTAMPTZ,
        metadata JSONB,
        UNIQUE (provider, provider_reference)
      )
    `

    await this.prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS idx_billing_invoices_org_issued_at
      ON billing_invoices (organization_id, issued_at DESC)
    `

    await this.prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS payment_events (
        id TEXT PRIMARY KEY,
        organization_id TEXT,
        provider TEXT NOT NULL,
        event_type TEXT NOT NULL,
        provider_event_id TEXT,
        payload JSONB NOT NULL,
        processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        is_valid BOOLEAN NOT NULL,
        validation_error TEXT,
        UNIQUE (provider, provider_event_id)
      )
    `

    await this.prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS idx_payment_events_org_processed_at
      ON payment_events (organization_id, processed_at DESC)
    `

    this.billingTablesReady = true
  }

  private async recordPaymentEvent(input: {
    organizationId: string | null | undefined
    provider: 'stripe' | 'paystack'
    eventType: string
    providerEventId?: string
    payload: unknown
    isValid: boolean
    validationError?: string
  }) {
    await this.ensureBillingTables()

    await this.prisma.$executeRaw`
      INSERT INTO payment_events (
        id,
        organization_id,
        provider,
        event_type,
        provider_event_id,
        payload,
        is_valid,
        validation_error
      ) VALUES (
        ${randomUUID()},
        ${input.organizationId ?? null},
        ${input.provider},
        ${input.eventType},
        ${input.providerEventId ?? null},
        ${JSON.stringify(input.payload ?? {})}::jsonb,
        ${input.isValid},
        ${input.validationError ?? null}
      )
      ON CONFLICT (provider, provider_event_id) DO NOTHING
    `
  }

  private async upsertInvoice(input: {
    organizationId: string
    provider: 'stripe' | 'paystack'
    providerReference: string | null
    amountMinor: number
    currency: string
    status: string
    paidAt: Date | null
  }) {
    await this.ensureBillingTables()

    const invoiceId = randomUUID()
    await this.prisma.$executeRaw`
      INSERT INTO billing_invoices (
        id,
        organization_id,
        provider,
        provider_reference,
        amount_minor,
        currency,
        status,
        paid_at,
        metadata
      ) VALUES (
        ${invoiceId},
        ${input.organizationId},
        ${input.provider},
        ${input.providerReference},
        ${input.amountMinor},
        ${input.currency},
        ${input.status},
        ${input.paidAt},
        ${JSON.stringify({ source: 'billing_webhook' })}::jsonb
      )
      ON CONFLICT (provider, provider_reference)
      DO UPDATE SET
        amount_minor = EXCLUDED.amount_minor,
        currency = EXCLUDED.currency,
        status = EXCLUDED.status,
        paid_at = EXCLUDED.paid_at,
        metadata = EXCLUDED.metadata
    `
  }

  private mapInvoiceAmount(amountMinor: number, currency: string): number {
    const zeroDecimalCurrencies = new Set(['JPY', 'KRW'])
    if (zeroDecimalCurrencies.has(currency.toUpperCase())) {
      return amountMinor
    }
    return amountMinor / 100
  }

  private async applyPlanFromCheckout(organizationId: string, planId: string) {
    const planToTier: Record<string, 'STARTER' | 'GROWTH' | 'SCALE'> = {
      starter: 'STARTER',
      growth: 'GROWTH',
      scale: 'SCALE',
    }

    const tier = planToTier[planId]
    if (!tier) {
      return
    }

    const previous = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { subscriptionTier: true, subscriptionStatus: true },
    })

    await this.prisma.organization.update({
      where: { id: organizationId },
      data: {
        subscriptionTier: tier,
        subscriptionStatus: 'ACTIVE',
        trialEndsAt: null,
      },
    })

    await this.prisma.auditLog.create({
      data: {
        organizationId,
        action: 'billing.subscription.upgraded',
        resourceType: 'subscription',
        resourceId: organizationId,
        changes: {
          previousTier: previous?.subscriptionTier ?? null,
          previousStatus: previous?.subscriptionStatus ?? null,
          newTier: tier,
          newStatus: 'ACTIVE',
          source: 'checkout_webhook',
        },
      },
    })
  }

  async getInvoices(organizationId: string) {
    await this.ensureBillingTables()

    const invoices = await this.prisma.$queryRaw<BillingInvoiceRow[]>`
      SELECT
        id,
        organization_id,
        provider,
        provider_reference,
        amount_minor,
        currency,
        status,
        issued_at,
        paid_at
      FROM billing_invoices
      WHERE organization_id = ${organizationId}
      ORDER BY issued_at DESC
      LIMIT 100
    `

    if (invoices.length > 0) {
      return invoices.map((invoice) => ({
        id: invoice.id,
        date: invoice.issued_at.toISOString(),
        amount: this.mapInvoiceAmount(Number(invoice.amount_minor), invoice.currency),
        currency: invoice.currency,
        status: invoice.status,
        provider: invoice.provider,
        providerReference: invoice.provider_reference,
        paidAt: invoice.paid_at?.toISOString() ?? null,
      }))
    }

    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true, createdAt: true },
    })

    if (!organization) {
      return []
    }

    return [
      {
        id: `inv_${organization.id}_trial`,
        date: organization.createdAt.toISOString(),
        amount: 0,
        currency: 'NGN',
        status: 'TRIAL',
      },
    ]
  }
}
