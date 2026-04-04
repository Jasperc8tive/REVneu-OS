'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'

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

function formatNgn(value: number): string {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 0,
  }).format(value)
}

function toPercent(value: number): string {
  return `${value.toFixed(1)}%`
}

export default function DashboardPage() {
  const { data: session } = useSession()
  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  const accessToken = (session?.user as { accessToken?: string } | undefined)?.accessToken

  const [runs, setRuns] = useState<AgentRun[]>([])
  const [recommendations, setRecommendations] = useState<Recommendation[]>([])
  const [metrics, setMetrics] = useState<MetricRecord[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

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

    const now = Date.now()
    const thirtyDayWindowMs = 30 * 24 * 60 * 60 * 1000

    const revenue30d = revenueMetrics
      .filter((item) => now - new Date(item.recordedAt).getTime() <= thirtyDayWindowMs)
      .reduce((sum, item) => sum + item.value, 0)

    const totalSpend = spendMetrics.reduce((sum, item) => sum + item.value, 0)
    const totalConversions = conversionMetrics.reduce((sum, item) => sum + item.value, 0)
    const totalRevenue = revenueMetrics.reduce((sum, item) => sum + item.value, 0)

    const cac = totalConversions > 0 ? totalSpend / totalConversions : 0
    const roas = totalSpend > 0 ? totalRevenue / totalSpend : 0

    const failedRuns = runs.filter((item) => item.status === 'FAILED').length
    const churnRisk = Math.min(100, failedRuns * 5 + (recommendations.length > 0 ? 10 : 0))

    const runRatePerDay = revenue30d > 0 ? revenue30d / 30 : 0
    const forecast30 = runRatePerDay * 30
    const forecast60 = runRatePerDay * 60
    const forecast90 = runRatePerDay * 90

    return {
      revenue30d,
      cac,
      roas,
      churnRisk,
      forecast30,
      forecast60,
      forecast90,
    }
  }, [metrics, recommendations.length, runs])

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
    { label: 'Monthly Revenue', value: formatNgn(totals.revenue30d), delta: 'live from metrics' },
    { label: 'CAC', value: formatNgn(totals.cac), delta: 'spend / conversions' },
    { label: 'ROAS', value: `${totals.roas.toFixed(2)}x`, delta: 'revenue / ad spend' },
    { label: 'Churn Risk', value: toPercent(totals.churnRisk), delta: 'agent signal model' },
  ]

  return (
    <div className="space-y-8">
      <section className="rounded-2xl bg-gradient-to-r from-brand-primary to-blue-700 p-6 text-white shadow-sm">
        <h1 className="text-2xl font-bold">Growth Dashboard</h1>
        <p className="mt-2 text-blue-100">
          Live control center for revenue, acquisition, and pipeline performance.
        </p>
      </section>

      {error ? (
        <section className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {error}
        </section>
      ) : null}

      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <article key={kpi.label} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">{kpi.label}</p>
            <p className="mt-2 text-2xl font-bold text-slate-900 font-mono">{loading ? '...' : kpi.value}</p>
            <p className="mt-1 text-xs text-emerald-600 font-semibold">{kpi.delta}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {[
          { period: '30 days', value: totals.forecast30 },
          { period: '60 days', value: totals.forecast60 },
          { period: '90 days', value: totals.forecast90 },
        ].map((forecast) => (
          <article key={forecast.period} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Forecast ({forecast.period})</p>
            <p className="mt-2 text-2xl font-bold text-slate-900 font-mono">
              {loading ? '...' : formatNgn(forecast.value)}
            </p>
            <p className="mt-1 text-xs text-slate-500">Revenue run-rate projection from latest 30 days</p>
          </article>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Critical Alerts</h2>
          <ul className="mt-4 space-y-3">
            {alerts.map((alert) => (
              <li key={alert} className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                {alert}
              </li>
            ))}
          </ul>
        </article>

        <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Quick Actions</h2>
          <div className="mt-4 space-y-2">
            <Link href="/dashboard/agents" className="block rounded-lg bg-brand-primary px-4 py-2 text-sm font-medium text-white text-center">
              View Agent Status
            </Link>
            <Link href="/dashboard/recommendations" className="block rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 text-center">
              Review Recommendations
            </Link>
            <Link href="/dashboard/integrations" className="block rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 text-center">
              Manage Integrations
            </Link>
          </div>
        </article>
      </section>
    </div>
  )
}
