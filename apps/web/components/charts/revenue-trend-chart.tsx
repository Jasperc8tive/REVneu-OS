'use client'

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

type TrendPoint = {
  day: string
  revenue: number
  spend: number
}

function formatNgn(value: number): string {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 0,
  }).format(value)
}

export function RevenueTrendChart({ data }: { data: TrendPoint[] }) {
  if (data.length === 0) {
    return (
      <div className="flex h-[280px] items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-500">
        No time-series data yet. Connect integrations and sync metrics.
      </div>
    )
  }

  return (
    <div className="h-[280px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="day" tick={{ fontSize: 12, fill: '#64748b' }} />
          <YAxis tickFormatter={(value: number) => formatNgn(value)} tick={{ fontSize: 12, fill: '#64748b' }} />
          <Tooltip formatter={(value) => formatNgn(Number(value ?? 0))} />
          <Legend />
          <Line type="monotone" dataKey="revenue" stroke="#0f766e" strokeWidth={2.5} dot={false} name="Revenue" />
          <Line type="monotone" dataKey="spend" stroke="#1d4ed8" strokeWidth={2.5} dot={false} name="Spend" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}