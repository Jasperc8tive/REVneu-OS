import { Injectable } from '@nestjs/common'
import { MetricsService } from '../metrics/metrics.service'

@Injectable()
export class ForecastsService {
  constructor(private readonly metricsService: MetricsService) {}

  async getForecasts(organizationId: string) {
    const metrics = await this.metricsService.listMetrics(organizationId, undefined, 'REVENUE')

    const now = Date.now()
    const thirtyDayWindowMs = 30 * 24 * 60 * 60 * 1000

    const revenue30d = metrics
      .filter((item) => now - new Date(item.recordedAt).getTime() <= thirtyDayWindowMs)
      .reduce((sum, item) => sum + Number(item.value), 0)

    const runRatePerDay = revenue30d > 0 ? revenue30d / 30 : 0

    const windows = [30, 60, 90]
    return windows.map((periodDays, index) => {
      const projectedRevenue = runRatePerDay * periodDays
      const confidenceScore = Math.max(0.6, 0.9 - index * 0.07)

      return {
        id: `forecast_${periodDays}`,
        periodDays,
        projectedRevenue,
        confidenceScore,
        generatedAt: new Date().toISOString(),
        riskFlag:
          periodDays === 30 && projectedRevenue < 1000000
            ? 'Forecast risk flag: projected 30-day revenue is below NGN 1,000,000 target.'
            : null,
      }
    })
  }
}
