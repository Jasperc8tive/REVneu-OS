import { Injectable, Logger } from '@nestjs/common'

type CounterName =
  | 'integration_sync_success_total'
  | 'integration_sync_failed_total'
  | 'integration_sync_dead_letter_total'
  | 'integration_token_refresh_attempt_total'
  | 'integration_token_refresh_success_total'
  | 'integration_token_refresh_failure_total'
  | 'integration_reauth_alert_total'

@Injectable()
export class IntegrationObservabilityService {
  private readonly logger = new Logger(IntegrationObservabilityService.name)
  private readonly counters = new Map<string, number>()

  recordSyncOutcome(status: 'SUCCESS' | 'FAILED' | 'DEAD_LETTER'): void {
    if (status === 'SUCCESS') {
      this.incrementCounter('integration_sync_success_total')
      return
    }

    if (status === 'DEAD_LETTER') {
      this.incrementCounter('integration_sync_dead_letter_total')
      return
    }

    this.incrementCounter('integration_sync_failed_total')
  }

  recordTokenRefreshAttempt(source: 'GA4' | 'GOOGLE_ADS', outcome: 'attempt' | 'success' | 'failure'): void {
    const labels = { source }
    if (outcome === 'attempt') {
      this.incrementCounter('integration_token_refresh_attempt_total', labels)
      this.logger.log(`Token refresh attempt source=${source}`)
      return
    }

    if (outcome === 'success') {
      this.incrementCounter('integration_token_refresh_success_total', labels)
      this.logger.log(`Token refresh success source=${source}`)
      return
    }

    this.incrementCounter('integration_token_refresh_failure_total', labels)
    this.logger.warn(`Token refresh failure source=${source}`)
  }

  recordNeedsReauthAlert(params: {
    organizationId: string
    integrationId: string
    source: string
    errorCount: number
    threshold: number
  }): void {
    this.incrementCounter('integration_reauth_alert_total', {
      source: params.source,
    })

    this.logger.error(
      `ALERT integration requires reauth organization=${params.organizationId} integration=${params.integrationId} source=${params.source} errorCount=${params.errorCount} threshold=${params.threshold}`,
    )
  }

  getCounter(name: CounterName, labels?: Record<string, string>): number {
    return this.counters.get(this.getKey(name, labels)) ?? 0
  }

  private incrementCounter(name: CounterName, labels?: Record<string, string>): void {
    const key = this.getKey(name, labels)
    const current = this.counters.get(key) ?? 0
    this.counters.set(key, current + 1)
  }

  private getKey(name: CounterName, labels?: Record<string, string>): string {
    if (!labels || Object.keys(labels).length === 0) {
      return name
    }

    const encodedLabels = Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join(',')

    return `${name}{${encodedLabels}}`
  }
}