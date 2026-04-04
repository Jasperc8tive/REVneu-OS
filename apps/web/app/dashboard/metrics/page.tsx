'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'

type MetricRecord = {
  id: string
  source: string
  metricType: string
  dimension?: string | null
  value: number
  currency?: string
  recordedAt: string
  periodStart?: string
  periodEnd?: string
}

function formatValue(value: number, metricType: string): string {
  if (
    metricType === 'spend' ||
    metricType === 'revenue' ||
    metricType === 'value'
  ) {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      maximumFractionDigits: 0,
    }).format(value)
  }

  return new Intl.NumberFormat('en-NG', {
    maximumFractionDigits: value < 100 ? 2 : 0,
  }).format(value)
}

function formatDate(isoDate: string): string {
  try {
    const date = new Date(isoDate)
    return new Intl.DateTimeFormat('en-NG', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date)
  } catch {
    return isoDate
  }
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

export default function MetricsPage() {
  const { data: session } = useSession()
  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  const accessToken = (session?.user as { accessToken?: string } | undefined)?.accessToken

  const [metrics, setMetrics] = useState<MetricRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!accessToken) {
      return
    }

    const headers = new Headers()
    headers.set('Authorization', `Bearer ${accessToken}`)
    headers.set('Content-Type', 'application/json')

    async function loadMetrics() {
      setLoading(true)
      setError('')
      try {
        const res = await fetch(`${apiBase}/api/v1/metrics`, { headers })

        if (!res.ok) {
          throw new Error('Failed to load metrics')
        }

        const payload = await res.json()
        const records = asList<MetricRecord>(payload)
        setMetrics(records)
      } catch {
        setError('Unable to load metrics right now.')
      } finally {
        setLoading(false)
      }
    }

    void loadMetrics()
  }, [accessToken, apiBase])

  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">Metrics Explorer</h1>
        <p className="mt-2 text-sm text-slate-600">
          Normalized records across all connected channels, shown in NGN-first format.
        </p>
      </header>

      {error ? (
        <section className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {error}
        </section>
      ) : null}

      {loading ? (
        <section className="rounded-xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-600">
          Loading metrics...
        </section>
      ) : metrics.length === 0 ? (
        <section className="rounded-xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-600">
          No metrics available yet. Connect integrations and run syncs to populate data.
        </section>
      ) : (
        <section className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 bg-slate-50">
                <th className="py-3 px-4">Source</th>
                <th className="py-3 px-4">Metric Type</th>
                <th className="py-3 px-4">Dimension</th>
                <th className="py-3 px-4 text-right">Value</th>
                <th className="py-3 px-4">Recorded</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {metrics.map((metric) => (
                <tr key={metric.id} className="text-slate-800 hover:bg-slate-50">
                  <td className="py-3 px-4 font-medium text-slate-900">
                    {metric.source}
                  </td>
                  <td className="py-3 px-4 font-mono text-xs text-slate-600">
                    {metric.metricType}
                  </td>
                  <td className="py-3 px-4 text-slate-600">
                    {metric.dimension || '—'}
                  </td>
                  <td className="py-3 px-4 text-right font-semibold">
                    {formatValue(metric.value, metric.metricType)}
                  </td>
                  <td className="py-3 px-4 text-xs text-slate-500">
                    {formatDate(metric.recordedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  )
}
