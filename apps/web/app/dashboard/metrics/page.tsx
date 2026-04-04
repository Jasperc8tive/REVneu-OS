const metricRows = [
  { source: 'Meta Ads', metric: 'spend', value: 'NGN 2,920,000', period: '01/04/2026 - 04/04/2026' },
  { source: 'GA4', metric: 'sessions', value: '182,330', period: '01/04/2026 - 04/04/2026' },
  { source: 'Paystack', metric: 'revenue', value: 'NGN 8,730,000', period: '01/04/2026 - 04/04/2026' },
]

export default function MetricsPage() {
  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">Metrics Explorer</h1>
        <p className="mt-2 text-sm text-slate-600">Normalized records across all connected channels, shown in NGN-first format.</p>
      </header>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-slate-500">
              <th className="py-2 pr-4">Source</th>
              <th className="py-2 pr-4">Metric Type</th>
              <th className="py-2 pr-4">Value</th>
              <th className="py-2">Period</th>
            </tr>
          </thead>
          <tbody>
            {metricRows.map((row) => (
              <tr key={`${row.source}-${row.metric}`} className="border-b border-slate-100 text-slate-800">
                <td className="py-3 pr-4">{row.source}</td>
                <td className="py-3 pr-4 font-mono text-xs">{row.metric}</td>
                <td className="py-3 pr-4 font-semibold">{row.value}</td>
                <td className="py-3">{row.period}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}
