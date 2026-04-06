'use client'

import { useEffect, useMemo, useState } from 'react'
import { Funnel, FunnelChart, LabelList, ResponsiveContainer, Tooltip } from 'recharts'
import { ChartContainer } from '@/components/ui/chart-container'
import { formatCount } from '@/lib/formatters'

export default function SalesPipelinePage() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const data = useMemo(
    () => [
      { name: 'Leads', value: 1240 },
      { name: 'Qualified', value: 780 },
      { name: 'Demo Booked', value: 402 },
      { name: 'Proposal', value: 248 },
      { name: 'Won', value: 131 },
    ],
    [],
  )

  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold font-display text-slate-900">Sales Pipeline</h1>
        <p className="mt-2 text-sm text-slate-600">
          Funnel performance from lead to closed-won, designed for weekly growth standups.
        </p>
      </header>

      <ChartContainer title="Pipeline Funnel" description="Interactive funnel chart for conversion drop-off analysis">
        <div className="h-[340px] w-full">
          {!mounted ? (
            <div className="skeleton h-full w-full rounded-xl" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <FunnelChart>
                <Tooltip formatter={(value) => formatCount(Number(value ?? 0))} />
                <Funnel data={data} dataKey="value" isAnimationActive>
                  <LabelList position="right" fill="#334155" stroke="none" dataKey="name" />
                </Funnel>
              </FunnelChart>
            </ResponsiveContainer>
          )}
        </div>
      </ChartContainer>
    </div>
  )
}
