const recommendations = [
  {
    id: 'rec-1',
    severity: 'HIGH',
    title: 'Reallocate 30% of Google Ads budget to Meta Ads',
    impact: 'Expected monthly savings: NGN 450,000',
  },
  {
    id: 'rec-2',
    severity: 'MEDIUM',
    title: 'Trigger retention sequence for dormant annual subscribers',
    impact: 'Potential retention uplift: 8-12%',
  },
  {
    id: 'rec-3',
    severity: 'LOW',
    title: 'Test +5% pricing on top-performing SKU segment',
    impact: 'Projected margin increase: 3.4%',
  },
]

const severityClassMap: Record<string, string> = {
  HIGH: 'bg-rose-100 text-rose-700',
  MEDIUM: 'bg-amber-100 text-amber-700',
  LOW: 'bg-emerald-100 text-emerald-700',
}

export default function RecommendationsPage() {
  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">Recommendations</h1>
        <p className="mt-2 text-sm text-slate-600">Structured recommendations from all Stage 4 agents, prioritized by severity.</p>
      </header>

      <section className="space-y-3">
        {recommendations.map((recommendation) => (
          <article key={recommendation.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <h2 className="text-sm font-semibold text-slate-900">{recommendation.title}</h2>
              <span className={`rounded-full px-2 py-1 text-xs font-medium ${severityClassMap[recommendation.severity]}`}>
                {recommendation.severity}
              </span>
            </div>
            <p className="mt-3 text-sm text-slate-600">{recommendation.impact}</p>
          </article>
        ))}
      </section>
    </div>
  )
}
