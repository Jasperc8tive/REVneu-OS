import Link from 'next/link'

const agents = [
  { id: 'marketing_performance', name: 'Marketing Performance Agent', status: 'SUCCESS', lastRun: '2 min ago' },
  { id: 'customer_acquisition', name: 'Customer Acquisition Insights Agent', status: 'SUCCESS', lastRun: '5 min ago' },
  { id: 'sales_pipeline', name: 'Sales Pipeline Intelligence Agent', status: 'RUNNING', lastRun: 'Running now' },
  { id: 'revenue_forecasting', name: 'Revenue Forecasting Agent', status: 'SUCCESS', lastRun: '12 min ago' },
  { id: 'pricing_optimization', name: 'Pricing Optimization Agent', status: 'FAILED', lastRun: '18 min ago' },
  { id: 'customer_retention', name: 'Customer Retention Agent', status: 'SUCCESS', lastRun: '7 min ago' },
  { id: 'growth_opportunity', name: 'Growth Opportunity Agent', status: 'SUCCESS', lastRun: '9 min ago' },
]

const statusClassMap: Record<string, string> = {
  SUCCESS: 'bg-emerald-100 text-emerald-700',
  RUNNING: 'bg-blue-100 text-blue-700',
  FAILED: 'bg-rose-100 text-rose-700',
}

export default function AgentsPage() {
  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">Agents</h1>
        <p className="mt-2 text-sm text-slate-600">Monitor all 7 agents, inspect latest run outcomes, and open detailed recommendations.</p>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {agents.map((agent) => (
          <article key={agent.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">{agent.name}</h2>
              <span className={`rounded-full px-2 py-1 text-xs font-medium ${statusClassMap[agent.status]}`}>
                {agent.status}
              </span>
            </div>
            <p className="mt-3 text-xs text-slate-500">Last run: {agent.lastRun}</p>
            <Link
              href={`/dashboard/agents/${agent.id}`}
              className="mt-4 inline-block rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              View details
            </Link>
          </article>
        ))}
      </section>
    </div>
  )
}
