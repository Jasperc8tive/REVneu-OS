import { Injectable, Logger } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { PrismaService } from '@revneu/database'

type GracePeriodRow = {
  organization_id: string
  provider: string
  provider_reference: string | null
}

@Injectable()
export class BillingSchedulerService {
  private readonly logger = new Logger(BillingSchedulerService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Run every hour: find organisations whose trial period has ended and
   * downgrade them from GROWTH/TRIAL → STARTER/ACTIVE (restricted free tier).
   * Organisations that have already been upgraded to a paid plan are unaffected
   * because their subscriptionStatus will be ACTIVE (not TRIAL).
   */
  @Cron('0 * * * *')
  async expireTrials(): Promise<void> {
    const now = new Date()

    const expiredOrgs = await this.prisma.organization.findMany({
      where: {
        subscriptionStatus: 'TRIAL',
        trialEndsAt: { lt: now },
      },
      select: { id: true, name: true },
      take: 500,
    })

    if (expiredOrgs.length === 0) {
      return
    }

    this.logger.log(`Expiring ${expiredOrgs.length} trial organisation(s)`)

    for (const org of expiredOrgs) {
      try {
        await this.prisma.organization.update({
          where: { id: org.id },
          data: {
            subscriptionTier: 'STARTER',
            subscriptionStatus: 'ACTIVE',
            trialEndsAt: null,
          },
        })

        await this.prisma.auditLog.create({
          data: {
            organizationId: org.id,
            action: 'billing.trial.expired',
            resourceType: 'subscription',
            resourceId: org.id,
            changes: {
              from: 'GROWTH/TRIAL',
              to: 'STARTER/ACTIVE',
              reason: 'trial_period_ended',
            },
          },
        })

        this.eventEmitter.emit('billing.trial.expired', {
          organizationId: org.id,
          organizationName: org.name,
          downgradedTo: 'STARTER',
          expiredAt: now.toISOString(),
        })

        this.logger.log(`Trial expired for org ${org.id} – downgraded to STARTER`)
      } catch (error) {
        this.logger.error(`Failed to expire trial for org ${org.id}`, error instanceof Error ? error.message : String(error))
      }
    }
  }

  /**
   * Run every hour: find organisations whose payment grace period has ended
   * and cancel their subscription (CANCELED status, tier stays as-is).
   * Grace periods are stored in the `billing_grace_periods` raw table which is
   * bootstrapped by BillingService on first payment failure.
   */
  @Cron('0 * * * *')
  async expireGracePeriods(): Promise<void> {
    const now = new Date()

    let expiredRows: GracePeriodRow[]

    try {
      expiredRows = await this.prisma.$queryRaw<GracePeriodRow[]>`
        SELECT organization_id, provider, provider_reference
        FROM billing_grace_periods
        WHERE is_active = TRUE
          AND grace_ends_at < ${now}
        LIMIT 500
      `
    } catch {
      // Table may not exist yet if no payment failure has ever occurred.
      return
    }

    if (expiredRows.length === 0) {
      return
    }

    this.logger.log(`Cancelling ${expiredRows.length} subscription(s) past grace period`)

    for (const row of expiredRows) {
      try {
        await this.prisma.organization.update({
          where: { id: row.organization_id },
          data: { subscriptionStatus: 'CANCELED' },
        })

        await this.prisma.$executeRaw`
          UPDATE billing_grace_periods
          SET is_active = FALSE
          WHERE organization_id = ${row.organization_id}
            AND is_active = TRUE
        `

        await this.prisma.auditLog.create({
          data: {
            organizationId: row.organization_id,
            action: 'billing.subscription.canceled',
            resourceType: 'subscription',
            resourceId: row.organization_id,
            changes: {
              reason: 'grace_period_expired',
              provider: row.provider,
              providerReference: row.provider_reference,
            },
          },
        })

        this.eventEmitter.emit('billing.subscription.canceled', {
          organizationId: row.organization_id,
          provider: row.provider,
          reason: 'grace_period_expired',
          canceledAt: now.toISOString(),
        })
      } catch (error) {
        this.logger.error(
          `Failed to cancel subscription for org ${row.organization_id}`,
          error instanceof Error ? error.message : String(error),
        )
      }
    }
  }
}
