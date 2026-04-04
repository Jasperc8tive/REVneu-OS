'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'

type Recommendation = {
  id: string
  agentId: string
  summary?: string | null
  findings: Array<{
    type: string
    severity?: string
    insight?: string
    recommendation?: string
    expectedImpact?: string
  }>
  createdAt: string
}

const severityClassMap: Record<string, string> = {
  HIGH: 'bg-rose-100 text-rose-700',
  MEDIUM: 'bg-amber-100 text-amber-700',
  LOW: 'bg-emerald-100 text-emerald-700',
}

const severityOrder: Record<string, number> = {
  HIGH: 0,
  MEDIUM: 1,
  LOW: 2,
}

function getSeverityFromFinding(
  finding: Recommendation['findings'][0],
): string {
  if (finding.severity) {
    return finding.severity
  }
  // Infer from type if possible
  const lowerType = (finding.type || '').toLowerCase()
  if (lowerType.includes('waste') || lowerType.includes('error') || lowerType.includes('risk')) {
    return 'HIGH'
  }
  if (lowerType.includes('opportunity')) {
    return 'MEDIUM'
  }
  return 'LOW'
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

export default function RecommendationsPage() {
  const { data: session } = useSession()
  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  const accessToken = (session?.user as { accessToken?: string } | undefined)?.accessToken

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

    async function loadRecommendations() {
      setLoading(true)
      setError('')
      try {
        const res = await fetch(`${apiBase}/api/v1/recommendations`, { headers })

        if (!res.ok) {
          throw new Error('Failed to load recommendations')
        }

        const payload = await res.json()
        const recs = asList<Recommendation>(payload)

        // Flatten findings into individual items for display
        const flatItems: Array<{
          id: string
          recId: string
          finding: Recommendation['findings'][0]
          severity: string
          createdAt: string
        }> = []

        for (const rec of recs) {
          for (const finding of rec.findings || []) {
            flatItems.push({
              id: `${rec.id}-${finding.type}`,
              recId: rec.id,
              finding,
              severity: getSeverityFromFinding(finding),
              createdAt: rec.createdAt,
            })
          }
        }

        // Sort by severity
        flatItems.sort(
          (a, b) =>
            (severityOrder[a.severity] ?? 2) - (severityOrder[b.severity] ?? 2),
        )

        setRecommendations(recs)
      } catch {
        setError('Unable to load recommendations right now.')
      } finally {
        setLoading(false)
      }
    }

    void loadRecommendations()
  }, [accessToken, apiBase])

  // Flatten and sort findings
  const flatItems: Array<{
    id: string
    recId: string
    finding: Recommendation['findings'][0]
    severity: string
    createdAt: string
  }> = []

  for (const rec of recommendations) {
    for (const finding of rec.findings || []) {
      flatItems.push({
        id: `${rec.id}-${finding.type}`,
        recId: rec.id,
        finding,
        severity: getSeverityFromFinding(finding),
        createdAt: rec.createdAt,
      })
    }
  }

  flatItems.sort(
    (a, b) => (severityOrder[a.severity] ?? 2) - (severityOrder[b.severity] ?? 2),
  )

  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">Recommendations</h1>
        <p className="mt-2 text-sm text-slate-600">
          Structured recommendations from all Stage 4 agents, prioritized by severity.
        </p>
      </header>

      {error ? (
        <section className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {error}
        </section>
      ) : null}

      {loading ? (
        <section className="rounded-xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-600">
          Loading recommendations...
        </section>
      ) : flatItems.length === 0 ? (
        <section className="rounded-xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-600">
          No recommendations yet. Run agents to generate insights.
        </section>
      ) : (
        <section className="space-y-3">
          {flatItems.map((item) => (
            <article
              key={item.id}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">
                    {item.finding.type}
                  </h2>
                  {item.finding.insight ? (
                    <p className="mt-2 text-sm text-slate-700">
                      {item.finding.insight}
                    </p>
                  ) : null}
                  {item.finding.recommendation ? (
                    <p className="mt-2 text-sm font-medium text-slate-800">
                      → {item.finding.recommendation}
                    </p>
                  ) : null}
                  {item.finding.expectedImpact ? (
                    <p className="mt-1 text-xs text-emerald-600">
                      Impact: {item.finding.expectedImpact}
                    </p>
                  ) : null}
                </div>
                <span
                  className={`rounded-full px-2 py-1 text-xs font-medium ${
                    severityClassMap[item.severity] ?? 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {item.severity}
                </span>
              </div>
            </article>
          ))}
        </section>
      )}
    </div>
  )
}
