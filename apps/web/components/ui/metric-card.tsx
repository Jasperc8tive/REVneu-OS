type MetricCardProps = {
  label: string
  value: string
  delta: string
  trend?: 'up' | 'down' | 'neutral'
  loading?: boolean
}

const trendClasses: Record<NonNullable<MetricCardProps['trend']>, string> = {
  up: 'text-emerald-700 bg-emerald-50 border-emerald-200',
  down: 'text-rose-700 bg-rose-50 border-rose-200',
  neutral: 'text-slate-600 bg-slate-50 border-slate-200',
}

export function MetricCard({ label, value, delta, trend = 'neutral', loading = false }: MetricCardProps) {
  return (
    <article className="rounded-2xl border border-[var(--border-muted)] bg-[var(--bg-panel)] p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      {loading ? (
        <div className="skeleton mt-4 h-8 w-40 rounded-md" />
      ) : (
        <p className="mt-3 text-3xl font-bold font-display text-slate-900">{value}</p>
      )}
      <span className={`mt-3 inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${trendClasses[trend]}`}>
        {delta}
      </span>
    </article>
  )
}
