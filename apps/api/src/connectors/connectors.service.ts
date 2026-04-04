import { BadRequestException, Injectable } from '@nestjs/common'
import axios from 'axios'

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

export interface ConnectorMetricRecord {
  metricType: MetricType
  dimension: string
  value: number
  currency: string
  recordedAt: Date
  periodStart: Date
  periodEnd: Date
  rawPayload: Record<string, unknown>
}

@Injectable()
export class ConnectorsService {
  async fetchRawMetrics(
    source: IntegrationSource,
    credentials: Record<string, unknown>,
  ): Promise<ConnectorMetricRecord[]> {
    const now = new Date()
    const dayStart = new Date(now)
    dayStart.setHours(0, 0, 0, 0)

    // Stage 3 starts with deterministic connector stubs so pipeline logic is stable.
    switch (source) {
      case 'GA4':
        return [
          {
            metricType: 'SESSIONS',
            dimension: 'all_traffic',
            value: 1240,
            currency: 'NGN',
            recordedAt: now,
            periodStart: dayStart,
            periodEnd: now,
            rawPayload: { source: 'ga4', sessions: 1240 },
          },
          {
            metricType: 'CONVERSIONS',
            dimension: 'purchase',
            value: 54,
            currency: 'NGN',
            recordedAt: now,
            periodStart: dayStart,
            periodEnd: now,
            rawPayload: { source: 'ga4', conversions: 54 },
          },
        ]
      case 'META_ADS':
        return [
          {
            metricType: 'SPEND',
            dimension: source.toLowerCase(),
            value: 75500,
            currency: 'NGN',
            recordedAt: now,
            periodStart: dayStart,
            periodEnd: now,
            rawPayload: { source, spend_minor: 7550000 },
          },
          {
            metricType: 'CLICKS',
            dimension: source.toLowerCase(),
            value: 1900,
            currency: 'NGN',
            recordedAt: now,
            periodStart: dayStart,
            periodEnd: now,
            rawPayload: { source, clicks: 1900 },
          },
        ]
      case 'GOOGLE_ADS':
        return this.fetchGoogleAdsMetrics(credentials)
      case 'PAYSTACK':
        return this.fetchPaystackMetrics(credentials)
      case 'HUBSPOT':
        return this.fetchHubSpotMetrics(credentials)
      case 'STRIPE':
        return [
          {
            metricType: 'REVENUE',
            dimension: source.toLowerCase(),
            value: 430000,
            currency: 'NGN',
            recordedAt: now,
            periodStart: dayStart,
            periodEnd: now,
            rawPayload: { source, transactions_total: 430000 },
          },
        ]
      default:
        return [
          {
            metricType: 'SESSIONS',
            dimension: `${source.toLowerCase()}_default`,
            value: 100,
            currency: 'NGN',
            recordedAt: now,
            periodStart: dayStart,
            periodEnd: now,
            rawPayload: { source, note: 'connector scaffold stub' },
          },
        ]
    }
  }

  private async fetchPaystackMetrics(
    credentials: Record<string, unknown>,
  ): Promise<ConnectorMetricRecord[]> {
    const apiKey = credentials.apiKey
    if (typeof apiKey !== 'string' || apiKey.trim().length === 0) {
      throw new BadRequestException('Paystack credentials are missing an apiKey')
    }

    const now = new Date()
    const periodStart = new Date(now)
    periodStart.setDate(periodStart.getDate() - 30)

    const response = await axios.get('https://api.paystack.co/transaction', {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      params: {
        perPage: 100,
      },
      timeout: 12_000,
    })

    const transactions = Array.isArray(response.data?.data)
      ? (response.data.data as Array<Record<string, unknown>>)
      : []

    const successful = transactions.filter((tx) => tx.status === 'success')
    const revenueNgn = successful.reduce((sum, tx) => {
      const amount = typeof tx.amount === 'number' ? tx.amount : 0
      return sum + amount / 100
    }, 0)

    return [
      {
        metricType: 'REVENUE',
        dimension: 'paystack_transactions',
        value: revenueNgn,
        currency: 'NGN',
        recordedAt: now,
        periodStart,
        periodEnd: now,
        rawPayload: {
          successfulCount: successful.length,
          sampledCount: transactions.length,
        },
      },
      {
        metricType: 'CONVERSIONS',
        dimension: 'paystack_success_count',
        value: successful.length,
        currency: 'NGN',
        recordedAt: now,
        periodStart,
        periodEnd: now,
        rawPayload: {
          source: 'paystack',
        },
      },
    ]
  }

  private async fetchHubSpotMetrics(
    credentials: Record<string, unknown>,
  ): Promise<ConnectorMetricRecord[]> {
    const apiKey = credentials.apiKey
    if (typeof apiKey !== 'string' || apiKey.trim().length === 0) {
      throw new BadRequestException('HubSpot credentials are missing an apiKey')
    }

    const now = new Date()
    const periodStart = new Date(now)
    periodStart.setDate(periodStart.getDate() - 30)

    const response = await axios.get('https://api.hubapi.com/crm/v3/objects/deals', {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      params: {
        limit: 100,
        properties: 'amount,dealstage,closedate',
      },
      timeout: 12_000,
    })

    const deals = Array.isArray(response.data?.results)
      ? (response.data.results as Array<Record<string, unknown>>)
      : []

    const closedWonDeals = deals.filter((deal) => {
      const properties = (deal.properties ?? {}) as Record<string, unknown>
      return properties.dealstage === 'closedwon'
    })

    const revenue = closedWonDeals.reduce((sum, deal) => {
      const properties = (deal.properties ?? {}) as Record<string, unknown>
      const amountRaw = properties.amount
      const amount = typeof amountRaw === 'string' ? parseFloat(amountRaw) : 0
      return sum + (Number.isFinite(amount) ? amount : 0)
    }, 0)

    return [
      {
        metricType: 'REVENUE',
        dimension: 'hubspot_closed_won',
        value: revenue,
        currency: 'NGN',
        recordedAt: now,
        periodStart,
        periodEnd: now,
        rawPayload: {
          closedWonCount: closedWonDeals.length,
          sampledCount: deals.length,
        },
      },
      {
        metricType: 'CONVERSIONS',
        dimension: 'hubspot_closed_won_count',
        value: closedWonDeals.length,
        currency: 'NGN',
        recordedAt: now,
        periodStart,
        periodEnd: now,
        rawPayload: {
          source: 'hubspot',
        },
      },
    ]
  }

  private async fetchGoogleAdsMetrics(
    credentials: Record<string, unknown>,
  ): Promise<ConnectorMetricRecord[]> {
    const accessToken = credentials.access_token
    const customerId = credentials.customerId ?? credentials.customer_id
    const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN

    if (typeof accessToken !== 'string' || accessToken.trim().length === 0) {
      throw new BadRequestException('Google Ads credentials are missing access_token')
    }

    if (typeof customerId !== 'string' || customerId.trim().length === 0) {
      throw new BadRequestException('Google Ads credentials are missing customerId')
    }

    if (!developerToken) {
      throw new BadRequestException('GOOGLE_ADS_DEVELOPER_TOKEN is not configured')
    }

    const query = [
      'SELECT',
      'metrics.cost_micros,',
      'metrics.clicks,',
      'metrics.impressions,',
      'metrics.conversions,',
      'segments.date',
      'FROM customer',
      'WHERE segments.date DURING LAST_30_DAYS',
    ].join(' ')

    const loginCustomerId = credentials.loginCustomerId ?? credentials.login_customer_id

    const response = await axios.post(
      `https://googleads.googleapis.com/v17/customers/${customerId}/googleAds:searchStream`,
      { query },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'developer-token': developerToken,
          ...(typeof loginCustomerId === 'string' && loginCustomerId.length > 0
            ? { 'login-customer-id': loginCustomerId }
            : {}),
        },
        timeout: 15_000,
      },
    )

    const chunks = Array.isArray(response.data)
      ? (response.data as Array<Record<string, unknown>>)
      : []

    let costMicros = 0
    let clicks = 0
    let impressions = 0
    let conversions = 0

    for (const chunk of chunks) {
      const rows = Array.isArray(chunk.results)
        ? (chunk.results as Array<Record<string, unknown>>)
        : []
      for (const row of rows) {
        const metrics = (row.metrics ?? {}) as Record<string, unknown>
        costMicros += Number(metrics.costMicros ?? 0)
        clicks += Number(metrics.clicks ?? 0)
        impressions += Number(metrics.impressions ?? 0)
        conversions += Number(metrics.conversions ?? 0)
      }
    }

    const now = new Date()
    const periodStart = new Date(now)
    periodStart.setDate(periodStart.getDate() - 30)

    return [
      {
        metricType: 'SPEND',
        dimension: 'google_ads',
        value: costMicros / 1_000_000,
        currency: 'NGN',
        recordedAt: now,
        periodStart,
        periodEnd: now,
        rawPayload: { costMicros, rows: chunks.length },
      },
      {
        metricType: 'CLICKS',
        dimension: 'google_ads',
        value: clicks,
        currency: 'NGN',
        recordedAt: now,
        periodStart,
        periodEnd: now,
        rawPayload: { clicks },
      },
      {
        metricType: 'IMPRESSIONS',
        dimension: 'google_ads',
        value: impressions,
        currency: 'NGN',
        recordedAt: now,
        periodStart,
        periodEnd: now,
        rawPayload: { impressions },
      },
      {
        metricType: 'CONVERSIONS',
        dimension: 'google_ads',
        value: conversions,
        currency: 'NGN',
        recordedAt: now,
        periodStart,
        periodEnd: now,
        rawPayload: { conversions },
      },
    ]
  }
}
