import type { SubscriptionTier } from '../types'

// ─── PLAN LIMITS ─────────────────────────────────────────────────────────────

export const PLAN_LIMITS: Record<
  SubscriptionTier,
  {
    agents: number
    integrations: number
    users: number
    refreshIntervalHours: number
    historyDays: number
    emailAlerts: boolean
    webhookActions: boolean
    apiAccess: boolean
  }
> = {
  TRIAL: {
    agents: 2,
    integrations: 2,
    users: 3,
    refreshIntervalHours: 24,
    historyDays: 30,
    emailAlerts: false,
    webhookActions: false,
    apiAccess: false,
  },
  STARTER: {
    agents: 2,
    integrations: 2,
    users: 3,
    refreshIntervalHours: 24,
    historyDays: 30,
    emailAlerts: false,
    webhookActions: false,
    apiAccess: false,
  },
  GROWTH: {
    agents: 5,
    integrations: 6,
    users: 10,
    refreshIntervalHours: 6,
    historyDays: 90,
    emailAlerts: true,
    webhookActions: false,
    apiAccess: false,
  },
  SCALE: {
    agents: 7,
    integrations: -1, // unlimited
    users: 25,
    refreshIntervalHours: 1,
    historyDays: -1, // unlimited
    emailAlerts: true,
    webhookActions: true,
    apiAccess: true,
  },
  ENTERPRISE: {
    agents: -1, // unlimited
    integrations: -1,
    users: -1,
    refreshIntervalHours: 1,
    historyDays: -1,
    emailAlerts: true,
    webhookActions: true,
    apiAccess: true,
  },
} as const

// ─── PRICING (NGN/month) ─────────────────────────────────────────────────────

export const PLAN_PRICING_NGN: Record<Exclude<SubscriptionTier, 'TRIAL' | 'ENTERPRISE'>, number> =
  {
    STARTER: 49_000,
    GROWTH: 150_000,
    SCALE: 450_000,
  } as const

// ─── NIGERIAN MARKET ─────────────────────────────────────────────────────────

export const NIGERIAN_INDUSTRIES = [
  'fintech',
  'ecommerce',
  'edtech',
  'logistics',
  'saas',
  'marketing_agency',
  'other',
] as const

export const DEFAULT_CURRENCY = 'NGN' as const
export const DEFAULT_TIMEZONE = 'Africa/Lagos' as const
export const DEFAULT_COUNTRY = 'NG' as const

// ─── AGENTS ──────────────────────────────────────────────────────────────────

export const AGENT_NAMES = [
  'marketing_performance',
  'customer_acquisition',
  'sales_pipeline',
  'revenue_forecasting',
  'pricing_optimization',
  'customer_retention',
  'growth_opportunity',
] as const

// ─── APP ─────────────────────────────────────────────────────────────────────

export const API_VERSION = 'v1' as const
export const TRIAL_DAYS = 14 as const
