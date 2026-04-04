// ─── ROLES & PLANS ───────────────────────────────────────────────────────────

export type UserRole = 'OWNER' | 'ADMIN' | 'ANALYST' | 'VIEWER'

export type SubscriptionTier = 'TRIAL' | 'STARTER' | 'GROWTH' | 'SCALE' | 'ENTERPRISE'

export type SubscriptionStatus = 'ACTIVE' | 'TRIAL' | 'PAST_DUE' | 'CANCELED'

// ─── INTEGRATIONS ────────────────────────────────────────────────────────────

export type IntegrationSource =
  | 'google_analytics'
  | 'meta_ads'
  | 'google_ads'
  | 'tiktok_ads'
  | 'hubspot'
  | 'salesforce'
  | 'paystack'
  | 'stripe'
  | 'shopify'
  | 'flutterwave'

export type IntegrationStatus = 'connected' | 'disconnected' | 'error' | 'syncing'

// ─── METRICS ─────────────────────────────────────────────────────────────────

export type MetricType =
  | 'spend'
  | 'revenue'
  | 'sessions'
  | 'conversions'
  | 'cac'
  | 'roas'
  | 'ltv'
  | 'churn_rate'
  | 'conversion_rate'
  | 'deals_created'
  | 'deals_closed'
  | 'mrr'
  | 'arr'

export interface MetricRecord {
  tenantId: string
  source: IntegrationSource
  metricType: MetricType
  dimension: string
  value: number
  currency: 'NGN' | 'USD'
  recordedAt: string
  periodStart: string
  periodEnd: string
}

// ─── AGENTS ──────────────────────────────────────────────────────────────────

export type AgentName =
  | 'marketing_performance'
  | 'customer_acquisition'
  | 'sales_pipeline'
  | 'revenue_forecasting'
  | 'pricing_optimization'
  | 'customer_retention'
  | 'growth_opportunity'

export type FindingSeverity = 'low' | 'medium' | 'high' | 'critical'

export interface AgentFinding {
  type: string
  severity: FindingSeverity
  insight: string
  recommendation: string
  expectedImpact?: string
  data?: Record<string, unknown>
}

export interface AgentOutput {
  agent: AgentName
  tenantId: string
  period: string
  runId: string
  findings: AgentFinding[]
  summary?: string
  generatedAt: string
  tokensUsed?: number
}

// ─── API RESPONSE ────────────────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
    details?: Record<string, unknown>
  }
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}

// ─── ORGANIZATION ────────────────────────────────────────────────────────────

export type NigerianIndustry =
  | 'fintech'
  | 'ecommerce'
  | 'edtech'
  | 'logistics'
  | 'saas'
  | 'marketing_agency'
  | 'other'
