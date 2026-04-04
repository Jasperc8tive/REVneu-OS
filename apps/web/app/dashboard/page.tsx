import Link from 'next/link'

const kpis = [
  { label: 'Monthly Revenue', value: 'NGN 18,420,000', delta: '+12.4%' },
  { label: 'CAC', value: 'NGN 28,700', delta: '-6.1%' },
  { label: 'ROAS', value: '4.3x', delta: '+0.8x' },
  { label: 'Churn Risk', value: '8.2%', delta: '-1.3%' },
]

const alerts = [
  'Meta Ads is outperforming Google Ads by 2.1x ROAS.',
  '3 enterprise deals have been stale for over 14 days.',
  'Forecast indicates you will miss monthly target by NGN 1.2M if no changes are made.',
]

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <section className="rounded-2xl bg-gradient-to-r from-brand-primary to-blue-700 p-6 text-white shadow-sm">
        <h1 className="text-2xl font-bold">Growth Dashboard</h1>
        <p className="mt-2 text-blue-100">
          Live control center for revenue, acquisition, and pipeline performance.
        </p>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <article key={kpi.label} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">{kpi.label}</p>
            <p className="mt-2 text-2xl font-bold text-slate-900 font-mono">{kpi.value}</p>
            <p className="mt-1 text-xs text-emerald-600 font-semibold">{kpi.delta} vs last 30 days</p>
          </article>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Critical Alerts</h2>
          <ul className="mt-4 space-y-3">
            {alerts.map((alert) => (
              <li key={alert} className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                {alert}
              </li>
            ))}
          </ul>
        </article>

        <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Quick Actions</h2>
          <div className="mt-4 space-y-2">
            <Link href="/dashboard/agents" className="block rounded-lg bg-brand-primary px-4 py-2 text-sm font-medium text-white text-center">
              View Agent Status
            </Link>
            <Link href="/dashboard/recommendations" className="block rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 text-center">
              Review Recommendations
            </Link>
            <Link href="/dashboard/integrations" className="block rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 text-center">
              Manage Integrations
            </Link>
          </div>
        </article>
      </section>
    </div>
  )
}
