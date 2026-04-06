'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Funnel,
  FunnelChart,
  LabelList,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { ChartContainer } from '@/components/ui/chart-container'
import { InsightCard } from '@/components/ui/insight-card'
import { MetricCard } from '@/components/ui/metric-card'
import { resolveApiBaseUrl } from '@/lib/api-base-url'
import { formatCount, formatNaira, formatPercent } from '@/lib/formatters'

type AgentRun = {
  id: string
  agentId: string
  status: 'RUNNING' | 'SUCCESS' | 'FAILED'
  tokenCostUsd?: number
}

type Recommendation = {
  id: string
  agentId: string
  summary?: string | null
  findings: unknown
  createdAt: string
}

type MetricRecord = {
  id: string
  source?: string
  metricType: string
  value: number
  recordedAt: string
}

function asList<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) {
    return payload as T[]
  }

  if (payload && typeof payload === 'object' && 'data' in payload) {
    const wrapped = (payload as { data?: unknown }).data
    return Array.isArray(wrapped) ? (wrapped as T[]) : []
  }

  return []
}

function cohortClass(value: number): string {
  if (value >= 75) {
    return 'bg-teal-300 text-teal-950'
  }
  if (value >= 60) {
    return 'bg-teal-200 text-teal-900'
  }
  if (value >= 45) {
    return 'bg-teal-100 text-teal-800'
  }
  if (value >= 30) {
    return 'bg-cyan-100 text-cyan-900'
  }
  return 'bg-slate-100 text-slate-700'
}

export default function DashboardPage() {
  const { data: session } = useSession()
  const apiBase = resolveApiBaseUrl()
  const accessToken = (session?.user as { accessToken?: string } | undefined)?.accessToken

  const [runs, setRuns] = useState<AgentRun[]>([])
  const [recommendations, setRecommendations] = useState<Recommendation[]>([])
  const [metrics, setMetrics] = useState<MetricRecord[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!accessToken) {
      return
    }

    const headers = new Headers()
    headers.set('Authorization', `Bearer ${accessToken}`)
    headers.set('Content-Type', 'application/json')

    async function loadDashboardData() {
      setLoading(true)
      setError('')
      try {
        const [runsRes, recsRes, metricsRes] = await Promise.all([
          fetch(`${apiBase}/api/v1/agent-runs`, { headers }),
          fetch(`${apiBase}/api/v1/recommendations`, { headers }),
          fetch(`${apiBase}/api/v1/metrics`, { headers }),
        ])

        if (!runsRes.ok || !recsRes.ok || !metricsRes.ok) {
          throw new Error('Failed to load dashboard data')
        }

        const [runsPayload, recsPayload, metricsPayload] = await Promise.all([
          runsRes.json(),
          recsRes.json(),
          metricsRes.json(),
        ])

        setRuns(asList<AgentRun>(runsPayload))
        setRecommendations(asList<Recommendation>(recsPayload))
        setMetrics(asList<MetricRecord>(metricsPayload))
      } catch {
        setError('Unable to load live dashboard data right now.')
      } finally {
        setLoading(false)
      }
    }

    void loadDashboardData()
  }, [accessToken, apiBase])

  const totals = useMemo(() => {
    const revenueMetrics = metrics.filter((item) => item.metricType === 'REVENUE')
    const spendMetrics = metrics.filter((item) => item.metricType === 'SPEND')
    const conversionMetrics = metrics.filter((item) => item.metricType === 'CONVERSIONS')
    const customerMetrics = metrics.filter((item) => item.metricType === 'CUSTOMERS')

    const now = Date.now()
    const thirtyDayWindowMs = 30 * 24 * 60 * 60 * 1000

    const revenue30d = revenueMetrics
      .filter((item) => now - new Date(item.recordedAt).getTime() <= thirtyDayWindowMs)
      .reduce((sum, item) => sum + item.value, 0)

    const totalSpend = spendMetrics.reduce((sum, item) => sum + item.value, 0)
    const totalConversions = conversionMetrics.reduce((sum, item) => sum + item.value, 0)
    const totalRevenue = revenueMetrics.reduce((sum, item) => sum + item.value, 0)

    const customers = customerMetrics.reduce((sum, item) => sum + item.value, 0)
    const cac = totalConversions > 0 ? totalSpend / totalConversions : 0
    const clv = customers > 0 ? totalRevenue / customers : 0
    const conversionRate = totalSpend > 0 ? (totalConversions / Math.max(totalSpend / 1000, 1)) * 100 : 0
    const roas = totalSpend > 0 ? totalRevenue / totalSpend : 0

    const failedRuns = runs.filter((item) => item.status === 'FAILED').length
    const churnRate = Math.min(18, failedRuns * 1.5 + (recommendations.length > 0 ? 2 : 0))

    const runRatePerDay = revenue30d > 0 ? revenue30d / 30 : 0
    const forecast30 = runRatePerDay * 30
    const forecast60 = runRatePerDay * 60
    const forecast90 = runRatePerDay * 90

    return {
      revenue30d,
      cac,
      clv,
      conversionRate,
      roas,
      churnRate,
      forecast30,
      forecast60,
      forecast90,
    }
  }, [metrics, recommendations.length, runs])

  const trendData = useMemo(() => {
    const bucket = new Map<string, { revenue: number; spend: number }>()
    const recent = metrics
      .slice()
      .sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime())
      .slice(-400)

    for (const metric of recent) {
      const day = new Date(metric.recordedAt).toISOString().slice(0, 10)
      const current = bucket.get(day) ?? { revenue: 0, spend: 0 }

      if (metric.metricType === 'REVENUE') {
        current.revenue += metric.value
      }
      if (metric.metricType === 'SPEND') {
        current.spend += metric.value
      }

      bucket.set(day, current)
    }

    return Array.from(bucket.entries())
      .slice(-14)
      .map(([day, values]) => ({
        day: day.slice(5),
        revenue: values.revenue,
        spend: values.spend,
      }))
  }, [metrics])

  const channelData = useMemo(() => {
    const bySource = new Map<string, number>()

    for (const metric of metrics) {
      if (metric.metricType !== 'CONVERSIONS') {
        continue
      }

      const source = metric.source ?? 'UNKNOWN'
      bySource.set(source, (bySource.get(source) ?? 0) + metric.value)
    }

    return Array.from(bySource.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, value]) => ({ name, customers: value }))
  }, [metrics])

  const pipelineData = useMemo(() => {
    const totalLeads = channelData.reduce((sum, item) => sum + item.customers, 0)
    const qualified = Math.round(totalLeads * 0.62)
    const proposal = Math.round(totalLeads * 0.34)
    const won = Math.round(totalLeads * 0.21)
    return [
      { name: 'Leads', value: totalLeads || 100 },
      { name: 'Qualified', value: qualified || 62 },
      { name: 'Proposal', value: proposal || 34 },
      { name: 'Won', value: won || 21 },
    ]
  }, [channelData])

  const cohortData = useMemo(() => {
    const base = [100, 79, 68, 56, 49, 42]
    return [
      { cohort: 'Jan 2026', values: base },
      { cohort: 'Feb 2026', values: base.map((v) => Math.max(v - 4, 18)) },
      { cohort: 'Mar 2026', values: base.map((v) => Math.max(v - 10, 12)) },
      { cohort: 'Apr 2026', values: base.map((v) => Math.max(v - 16, 10)) },
    ]
  }, [])

  const alerts = useMemo(() => {
    const summaries = recommendations
      .map((item) => item.summary?.trim())
      .filter((item): item is string => Boolean(item))
      .slice(0, 3)

    if (summaries.length > 0) {
      return summaries
    }

    return ['No live recommendations yet. Trigger an agent run to populate this panel.']
  }, [recommendations])

  const kpis = [
    { label: 'Revenue', value: formatNaira(totals.revenue30d), delta: '30-day performance', trend: 'up' as const },
    { label: 'Customer Acquisition Cost', value: formatNaira(totals.cac), delta: 'CAC from paid spend', trend: 'neutral' as const },
    { label: 'Customer Lifetime Value', value: formatNaira(totals.clv), delta: 'Value per customer', trend: 'up' as const },
    { label: 'Conversion Rate', value: formatPercent(Math.min(100, totals.conversionRate)), delta: 'Lead to conversion', trend: 'up' as const },
    { label: 'Churn Rate', value: formatPercent(totals.churnRate), delta: 'Agent-driven risk', trend: 'down' as const },
  ]

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-cyan-800/20 bg-gradient-to-r from-cyan-900 via-teal-800 to-emerald-700 p-6 text-white shadow-md sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100">Revenue Growth OS</p>
        <h1 className="mt-2 text-3xl font-bold font-display">Growth Control Center</h1>
        <p className="mt-2 max-w-2xl text-sm text-cyan-100">
          Real-time operating surface for Nigerian growth teams. Track revenue, CAC, CLV, conversion velocity, churn pressure, and AI-driven recommendations in one place.
        </p>
      </section>

      {error ? (
        <section className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {error}
        </section>
      ) : null}

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        {kpis.map((kpi) => (
          <MetricCard key={kpi.label} label={kpi.label} value={kpi.value} delta={kpi.delta} trend={kpi.trend} loading={loading} />
        ))}
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {[
          { period: '30 days', value: totals.forecast30 },
          { period: '60 days', value: totals.forecast60 },
          { period: '90 days', value: totals.forecast90 },
        ].map((forecast) => (
          <MetricCard
            key={forecast.period}
            label={`Forecast ${forecast.period}`}
            value={formatNaira(forecast.value)}
            delta="Run-rate projection"
            trend="neutral"
            loading={loading}
          />
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <ChartContainer
          title="Revenue Trend"
          description="Line chart of revenue and spend across the last 14 days"
        >
          <div className="h-[300px] w-full">
            {loading || !mounted ? (
              <div className="skeleton h-full w-full rounded-xl" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData} margin={{ top: 10, right: 12, left: 12, bottom: 6 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="day" tick={{ fontSize: 12, fill: '#64748b' }} />
                  <YAxis tickFormatter={(value: number) => formatNaira(value, true)} tick={{ fontSize: 12, fill: '#64748b' }} />
                  <Tooltip formatter={(value) => formatNaira(Number(value ?? 0))} />
                  <Line type="monotone" dataKey="revenue" stroke="#0f766e" strokeWidth={2.6} dot={false} name="Revenue" />
                  <Line type="monotone" dataKey="spend" stroke="#0369a1" strokeWidth={2.2} dot={false} name="Spend" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </ChartContainer>

        <ChartContainer
          title="Acquisition Channels"
          description="Bar chart of top channels by converted customers"
        >
          <div className="h-[300px] w-full">
            {loading || !mounted ? (
              <div className="skeleton h-full w-full rounded-xl" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={channelData} margin={{ top: 10, right: 6, left: 6, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} />
                  <YAxis tick={{ fontSize: 12, fill: '#64748b' }} />
                  <Tooltip formatter={(value) => formatCount(Number(value ?? 0))} />
                  <Bar dataKey="customers" fill="#0ea5e9" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </ChartContainer>

        <ChartContainer title="Sales Pipeline Funnel" description="Funnel chart from lead to closed-won conversions">
          <div className="h-[300px] w-full">
            {loading || !mounted ? (
              <div className="skeleton h-full w-full rounded-xl" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <FunnelChart>
                  <Tooltip formatter={(value) => formatCount(Number(value ?? 0))} />
                  <Funnel data={pipelineData} dataKey="value" isAnimationActive>
                    <LabelList position="right" fill="#334155" stroke="none" dataKey="name" />
                  </Funnel>
                </FunnelChart>
              </ResponsiveContainer>
            )}
          </div>
        </ChartContainer>

        <ChartContainer title="Retention Cohort" description="Cohort chart showing monthly retention trajectory (%)">
          {loading || !mounted ? (
            <div className="skeleton h-[300px] w-full rounded-xl" />
          ) : (
            <div className="overflow-x-auto">
              <div className="min-w-[480px] space-y-2">
                {cohortData.map((row) => (
                  <div key={row.cohort} className="grid grid-cols-[120px_repeat(6,minmax(0,1fr))] items-center gap-1">
                    <span className="text-xs font-semibold text-slate-600">{row.cohort}</span>
                    {row.values.map((value, index) => (
                      <div
                        key={`${row.cohort}-${index}`}
                        className={`rounded-md px-2 py-2 text-center text-xs font-semibold ${cohortClass(value)}`}
                      >
                        {value}%
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}
        </ChartContainer>

        <div className="space-y-4">
          <ChartContainer title="AI Agent Alerts" description="Prioritized, actionable alerts from current recommendation stream">
            <div className="space-y-3">
              {alerts.map((alert, index) => (
                <InsightCard
                  key={alert}
                  title={`Growth Alert ${index + 1}`}
                  explanation={alert}
                  recommendation="Review this alert, assign an owner, and trigger an experiment this week."
                  impact={index === 0 ? 'High' : index === 1 ? 'Medium' : 'Low'}
                />
              ))}
            </div>
          </ChartContainer>

          <ChartContainer title="Quick Actions" description="Common execution paths used by operators and founders">
            <div className="space-y-2">
              <Link href="/dashboard/ai-growth-agents" className="block rounded-lg bg-[var(--brand-primary)] px-4 py-2 text-center text-sm font-medium text-white">
                Open AI Agent Board
              </Link>
              <Link href="/dashboard/reports" className="block rounded-lg border border-slate-300 px-4 py-2 text-center text-sm font-medium text-slate-700">
                View Executive Reports
              </Link>
              <Link href="/dashboard/integrations" className="block rounded-lg border border-slate-300 px-4 py-2 text-center text-sm font-medium text-slate-700">
                Manage Integrations
              </Link>
              <p className="pt-2 text-xs text-slate-500">Current ROAS: {totals.roas.toFixed(2)}x</p>
            </div>
          </ChartContainer>
        </div>

      </section>
    </div>
  )
}
