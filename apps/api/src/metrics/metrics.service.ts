import { Injectable } from '@nestjs/common'
import { PrismaService } from '@revneu/database'
import type { ConnectorMetricRecord } from '../connectors/connectors.service'

type IntegrationSource =
  | 'GA4'
  | 'META_ADS'
  | 'GOOGLE_ADS'
  | 'HUBSPOT'
  | 'PAYSTACK'
  | 'STRIPE'
  | 'SHOPIFY'
  | 'FLUTTERWAVE'
  | 'TIKTOK_ADS'
  | 'SALESFORCE'

type MetricType =
  | 'SPEND'
  | 'REVENUE'
  | 'SESSIONS'
  | 'CONVERSIONS'
  | 'CLICKS'
  | 'IMPRESSIONS'
  | 'CAC'
  | 'ROAS'
  | 'LTV'

@Injectable()
export class MetricsService {
  constructor(private readonly prisma: PrismaService) {}

  async ingestRecords(
    organizationId: string,
    source: IntegrationSource,
    records: ConnectorMetricRecord[],
    integrationId?: string,
  ): Promise<number> {
    if (records.length === 0) {
      return 0
    }

    const result = await this.prisma.metricRecord.createMany({
      data: records.map((record) => ({
        organizationId,
        integrationId,
        source,
        metricType: record.metricType,
        dimension: record.dimension,
        value: record.value,
        currency: record.currency,
        recordedAt: record.recordedAt,
        periodStart: record.periodStart,
        periodEnd: record.periodEnd,
        rawPayload: record.rawPayload as unknown as object,
      })),
    })

    return result.count
  }

  async listMetrics(
    organizationId: string,
    source?: IntegrationSource,
    metricType?: MetricType,
  ) {
    return this.prisma.metricRecord.findMany({
      where: {
        organizationId,
        ...(source ? { source } : {}),
        ...(metricType ? { metricType } : {}),
      },
      orderBy: { recordedAt: 'desc' },
      take: 200,
    })
  }
}
