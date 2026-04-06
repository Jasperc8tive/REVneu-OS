import Link from 'next/link'

const reportCards = [
  {
    title: 'Executive Weekly Pulse',
    description: 'Revenue, acquisition, and churn trend summary for leadership reviews.',
    href: '/dashboard/revenue-analytics',
  },
  {
    title: 'Channel Efficiency Report',
    description: 'Compare CAC and conversion performance by acquisition source.',
    href: '/dashboard/customer-acquisition',
  },
  {
    title: 'Retention and Cohort Health',
    description: 'Monitor retention decay and high-risk customer segments.',
    href: '/dashboard/retention-intelligence',
  },
]

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold font-display text-slate-900">Reports</h1>
        <p className="mt-2 text-sm text-slate-600">
          Reusable board-level reports for founders, marketers, and operations leaders.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {reportCards.map((card) => (
          <article key={card.title} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">{card.title}</h2>
            <p className="mt-2 text-sm text-slate-600">{card.description}</p>
            <Link
              href={card.href}
              className="mt-4 inline-block rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Open report
            </Link>
          </article>
        ))}
      </section>
    </div>
  )
}
