'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'

type AgentRun = {
  id: string
  agentId: string
  status: 'RUNNING' | 'SUCCESS' | 'FAILED'
  createdAt: string
  durationMs?: number
  tokensUsed?: number
  tokenCostUsd?: number
}

type Recommendation = {
  id: string
  agentId: string
  summary?: string | null
  findings: unknown
  createdAt: string
}

const agentNameMap: Record<string, string> = {
  marketing_performance: 'Marketing Performance Agent',
  customer_acquisition: 'Customer Acquisition Insights Agent',
  sales_pipeline: 'Sales Pipeline Intelligence Agent',
  revenue_forecasting: 'Revenue Forecasting Agent',
  pricing_optimization: 'Pricing Optimization Agent',
  customer_retention: 'Customer Retention Agent',
  growth_opportunity: 'Growth Opportunity Agent',
}

function asList<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[]
  if (payload && typeof payload === 'object' && 'data' in payload) {
    const wrapped = (payload as { data?: unknown }).data
    return Array.isArray(wrapped) ? (wrapped as T[]) : []
  }
  return []
}

function relativeTimeFromNow(dateStr: string): string {
  const seconds = Math.floor((new Date().getTime() - new Date(dateStr).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

function formatDuration(ms?: number): string {
  if (!ms) return '—'
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

interface AgentDetailProps {
  params: { id: string }
}

export default function AgentDetailPage({ params }: AgentDetailProps) {
  const { data: session } = useSession()
  const agentName = agentNameMap[params.id] ?? params.id.replaceAll('_', ' ')

  const [runs, setRuns] = useState<AgentRun[]>([])
  const [recommendations, setRecommendations] = useState<Recommendation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      if (!session?.user) return

      try {
        setLoading(true)
        const accessToken = (session?.user as { accessToken?: string } | undefined)?.accessToken || ''
        const authHeader = `Bearer ${accessToken}`

        const [runsRes, recsRes] = await Promise.all([
          fetch(`/api/v1/agent-runs?agentId=${params.id}`, { headers: { Authorization: authHeader } }),
          fetch(`/api/v1/recommendations?agentId=${params.id}`, { headers: { Authorization: authHeader } }),
        ])

        if (!runsRes.ok || !recsRes.ok) throw new Error('Failed to fetch')

        setRuns(asList(await runsRes.json()))
        setRecommendations(asList(await recsRes.json()))
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error loading data')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [session, params.id])

  const stats = useMemo(
    () => ({
      total: runs.length,
      successful: runs.filter((r) => r.status === 'SUCCESS').length,
      failed: runs.filter((r) => r.status === 'FAILED').length,
      totalCost: runs.reduce((sum, r) => sum + (r.tokenCostUsd || 0), 0),
    }),
    [runs]
  )

  if (loading) return <div className="h-96 animate-pulse rounded-xl bg-slate-200" />
  if (error) return <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>

  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">{agentName}</h1>

        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-lg bg-slate-50 p-3">
            <div className="text-2xl font-bold text-slate-900">{stats.total}</div>
            <div className="text-xs text-slate-600">Total Runs</div>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <div className="text-2xl font-bold text-green-600">{stats.successful}</div>
            <div className="text-xs text-slate-600">Successful</div>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <div className="text-2xl font-bold text-red-600">{stats.failed}</div>
            <div className="text-xs text-slate-600">Failed</div>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <div className="text-2xl font-bold text-slate-900">${stats.totalCost.toFixed(2)}</div>
            <div className="text-xs text-slate-600">Total Cost</div>
          </div>
        </div>
      </header>

      <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Execution History</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="px-4 py-2 text-left font-semibold text-slate-700">Time</th>
                <th className="px-4 py-2 text-left font-semibold text-slate-700">Status</th>
                <th className="px-4 py-2 text-right font-semibold text-slate-700">Duration</th>
                <th className="px-4 py-2 text-right font-semibold text-slate-700">Tokens</th>
                <th className="px-4 py-2 text-right font-semibold text-slate-700">Cost</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr key={run.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-900">{relativeTimeFromNow(run.createdAt)}</td>
                  <td className="px-4 py-3 text-slate-700">{run.status}</td>
                  <td className="px-4 py-3 text-right text-slate-700">{formatDuration(run.durationMs)}</td>
                  <td className="px-4 py-3 text-right text-slate-700">{run.tokensUsed || 0}</td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-900">${(run.tokenCostUsd || 0).toFixed(4)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {runs.length === 0 && <p className="mt-4 text-sm text-slate-600">No runs yet</p>}
        </div>
      </article>

      {recommendations.length > 0 && (
        <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Latest Recommendations</h2>
          <div className="mt-4 space-y-3">
            {recommendations.slice(0, 5).map((rec) => (
              <div key={rec.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-sm text-slate-700">{rec.summary || 'No summary'}</p>
                <p className="mt-1 text-xs text-slate-500">{relativeTimeFromNow(rec.createdAt)}</p>
              </div>
            ))}
          </div>
        </article>
      )}
    </div>
  )
}
