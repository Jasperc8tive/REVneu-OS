import { Injectable, Logger } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { PrismaService } from '@revneu/database'

@Injectable()
export class BillingSchedulerService {
  private readonly logger = new Logger(BillingSchedulerService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  private get prismaExt(): PrismaService & {
    billingGracePeriod: {
      findMany: (args: unknown) => Promise<Array<{
        organizationId: string
        provider: string
        providerReference: string | null
      }>>
      update: (args: unknown) => Promise<unknown>
    }
  } {
    return this.prisma as PrismaService & {
      billingGracePeriod: {
        findMany: (args: unknown) => Promise<Array<{
          organizationId: string
          provider: string
          providerReference: string | null
        }>>
        update: (args: unknown) => Promise<unknown>
      }
    }
  }

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

    const expiredRows = await this.prismaExt.billingGracePeriod.findMany({
      where: {
        isActive: true,
        graceEndsAt: { lt: now },
      },
      select: {
        organizationId: true,
        provider: true,
        providerReference: true,
      },
      take: 500,
    })

    if (expiredRows.length === 0) {
      return
    }

    this.logger.log(`Cancelling ${expiredRows.length} subscription(s) past grace period`)

    for (const row of expiredRows) {
      try {
        await this.prisma.organization.update({
          where: { id: row.organizationId },
          data: { subscriptionStatus: 'CANCELED' },
        })

        await this.prismaExt.billingGracePeriod.update({
          where: { organizationId: row.organizationId },
          data: { isActive: false },
        })

        await this.prisma.auditLog.create({
          data: {
            organizationId: row.organizationId,
            action: 'billing.subscription.canceled',
            resourceType: 'subscription',
            resourceId: row.organizationId,
            changes: {
              reason: 'grace_period_expired',
              provider: row.provider,
              providerReference: row.providerReference,
            },
          },
        })

        this.eventEmitter.emit('billing.subscription.canceled', {
          organizationId: row.organizationId,
          provider: row.provider,
          reason: 'grace_period_expired',
          canceledAt: now.toISOString(),
        })
      } catch (error) {
        this.logger.error(
          `Failed to cancel subscription for org ${row.organizationId}`,
          error instanceof Error ? error.message : String(error),
        )
      }
    }
  }
}
