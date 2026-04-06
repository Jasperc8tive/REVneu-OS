'use client'

import { Cell, Funnel, FunnelChart, LabelList, ResponsiveContainer, Tooltip } from 'recharts'

type FunnelPoint = {
  name: string
  value: number
}

const COLORS = ['#1d4ed8', '#0ea5e9', '#14b8a6', '#22c55e', '#84cc16']

export function SourceConversionFunnel({ data }: { data: FunnelPoint[] }) {
  if (data.length === 0) {
    return (
      <div className="flex h-[280px] items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-500">
        No conversion funnel data yet.
      </div>
    )
  }

  return (
    <div className="h-[280px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <FunnelChart>
          <Tooltip formatter={(value) => new Intl.NumberFormat('en-NG').format(Number(value ?? 0))} />
          <Funnel dataKey="value" data={data} isAnimationActive>
            <LabelList position="right" fill="#334155" stroke="none" dataKey="name" />
            {data.map((entry, index) => (
              <Cell key={`${entry.name}-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Funnel>
        </FunnelChart>
      </ResponsiveContainer>
    </div>
  )
}