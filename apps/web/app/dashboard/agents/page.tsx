'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'

type AgentRun = {
  id: string
  agentId: string
  status: 'RUNNING' | 'SUCCESS' | 'FAILED'
  createdAt: string
  finishedAt?: string | null
  tokenCostUsd?: number
}

type Recommendation = {
  id: string
  agentId: string
  summary?: string | null
  createdAt: string
}

type AgentDescriptor = {
  id: string
  name: string
}

const AGENTS: AgentDescriptor[] = [
  { id: 'marketing_performance', name: 'Marketing Performance Agent' },
  { id: 'customer_acquisition', name: 'Customer Acquisition Insights Agent' },
  { id: 'sales_pipeline', name: 'Sales Pipeline Intelligence Agent' },
  { id: 'revenue_forecasting', name: 'Revenue Forecasting Agent' },
  { id: 'pricing_optimization', name: 'Pricing Optimization Agent' },
  { id: 'customer_retention', name: 'Customer Retention Agent' },
  { id: 'growth_opportunity', name: 'Growth Opportunity Agent' },
]

const statusClassMap: Record<string, string> = {
  SUCCESS: 'bg-emerald-100 text-emerald-700',
  RUNNING: 'bg-blue-100 text-blue-700',
  FAILED: 'bg-rose-100 text-rose-700',
  PENDING: 'bg-slate-100 text-slate-600',
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

function relativeTimeFromNow(isoDate: string): string {
  const diffMs = Date.now() - new Date(isoDate).getTime()
  const minutes = Math.floor(diffMs / (1000 * 60))
  if (minutes < 1) {
    return 'just now'
  }
  if (minutes < 60) {
    return `${minutes} min ago`
  }
  const hours = Math.floor(minutes / 60)
  if (hours < 24) {
    return `${hours} hr ago`
  }
  const days = Math.floor(hours / 24)
  return `${days} day ago`
}

export default function AgentsPage() {
  const { data: session } = useSession()
  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  const accessToken = (session?.user as { accessToken?: string } | undefined)?.accessToken

  const [runs, setRuns] = useState<AgentRun[]>([])
  const [recommendations, setRecommendations] = useState<Recommendation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!accessToken) {
      return
    }

    const headers = new Headers()
    headers.set('Authorization', `Bearer ${accessToken}`)
    headers.set('Content-Type', 'application/json')

    async function loadAgentData() {
      setLoading(true)
      setError('')
      try {
        const [runsRes, recsRes] = await Promise.all([
          fetch(`${apiBase}/api/v1/agent-runs`, { headers }),
          fetch(`${apiBase}/api/v1/recommendations`, { headers }),
        ])

        if (!runsRes.ok || !recsRes.ok) {
          throw new Error('Failed to load agent data')
        }

        const [runsPayload, recsPayload] = await Promise.all([runsRes.json(), recsRes.json()])
        setRuns(asList<AgentRun>(runsPayload))
        setRecommendations(asList<Recommendation>(recsPayload))
      } catch {
        setError('Unable to load live agent status right now.')
      } finally {
        setLoading(false)
      }
    }

    void loadAgentData()
  }, [accessToken, apiBase])

  const agentCards = useMemo(() => {
    return AGENTS.map((agent) => {
      const latestRun = runs.find((item) => item.agentId === agent.id)
      const latestRecommendation = recommendations.find((item) => item.agentId === agent.id)
      const status = latestRun?.status ?? 'PENDING'

      return {
        ...agent,
        status,
        lastRun: latestRun?.createdAt ? relativeTimeFromNow(latestRun.createdAt) : 'No runs yet',
        tokenCostUsd: latestRun?.tokenCostUsd ?? 0,
        recommendationSummary: latestRecommendation?.summary?.trim() || 'No recommendation yet',
      }
    })
  }, [recommendations, runs])

  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">Agents</h1>
        <p className="mt-2 text-sm text-slate-600">Monitor all 7 agents, inspect latest run outcomes, and open detailed recommendations.</p>
      </header>

      {error ? (
        <section className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {error}
        </section>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {agentCards.map((agent) => (
          <article key={agent.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-slate-900">{agent.name}</h2>
              <span className={`rounded-full px-2 py-1 text-xs font-medium ${statusClassMap[agent.status]}`}>
                {loading ? 'LOADING' : agent.status}
              </span>
            </div>
            <p className="mt-3 text-xs text-slate-500">Last run: {loading ? '...' : agent.lastRun}</p>
            <p className="mt-1 text-xs text-slate-500">Token cost (USD): {loading ? '...' : agent.tokenCostUsd.toFixed(4)}</p>
            <p className="mt-3 rounded-lg bg-slate-50 p-2 text-xs text-slate-700 line-clamp-2">{agent.recommendationSummary}</p>
            <Link
              href={`/dashboard/agents/${agent.id}`}
              className="mt-4 inline-block rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              View details
            </Link>
          </article>
        ))}
      </section>
    </div>
  )
}
