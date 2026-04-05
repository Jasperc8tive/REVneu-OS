import { Injectable, Logger } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'

type PaymentFailedPayload = {
  organizationId: string
  provider: 'stripe' | 'paystack'
  providerReference: string | null
  graceEndsAt: string
}

@Injectable()
export class BillingNotificationsListener {
  private readonly logger = new Logger(BillingNotificationsListener.name)

  @OnEvent('billing.payment.failed')
  handlePaymentFailed(payload: PaymentFailedPayload): void {
    this.logger.warn(
      `billing.payment.failed org=${payload.organizationId} provider=${payload.provider} graceEndsAt=${payload.graceEndsAt}`,
    )
  }

  @OnEvent('billing.trial.expired')
  handleTrialExpired(payload: { organizationId: string; expiredAt: string }): void {
    this.logger.log(
      `billing.trial.expired org=${payload.organizationId} expiredAt=${payload.expiredAt}`,
    )
  }

  @OnEvent('billing.subscription.canceled')
  handleSubscriptionCanceled(payload: { organizationId: string; canceledAt: string }): void {
    this.logger.warn(
      `billing.subscription.canceled org=${payload.organizationId} canceledAt=${payload.canceledAt}`,
    )
  }
}
