type InsightCardProps = {
  title: string
  explanation: string
  recommendation: string
  impact: 'Low' | 'Medium' | 'High'
}

const impactClasses: Record<InsightCardProps['impact'], string> = {
  High: 'bg-rose-100 text-rose-800 border-rose-200',
  Medium: 'bg-amber-100 text-amber-800 border-amber-200',
  Low: 'bg-emerald-100 text-emerald-800 border-emerald-200',
}

export function InsightCard({ title, explanation, recommendation, impact }: InsightCardProps) {
  return (
    <article className="rounded-2xl border border-[var(--border-muted)] bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-base font-bold text-slate-900">{title}</h3>
        <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${impactClasses[impact]}`}>
          {impact} impact
        </span>
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-700">{explanation}</p>
      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Recommended action</p>
        <p className="mt-1 text-sm font-medium text-slate-900">{recommendation}</p>
      </div>
    </article>
  )
}
