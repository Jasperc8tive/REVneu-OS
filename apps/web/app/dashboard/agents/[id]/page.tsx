type AgentDetailPageProps = {
  params: {
    id: string
  }
}

const agentNameMap: Record<string, string> = {
  marketing_performance: 'Marketing Performance Agent',
  customer_acquisition: 'Customer Acquisition Insights Agent',
  sales_pipeline: 'Sales Pipeline Intelligence Agent',
  revenue_forecasting: 'Revenue Forecasting Agent',
  pricing_optimization: 'Pricing Optimization Agent',
  customer_retention: 'Customer Retention Agent',
  growth_opportunity: 'Growth Opportunity Agent',
}

export default function AgentDetailPage({ params }: AgentDetailPageProps) {
  const agentName = agentNameMap[params.id] ?? params.id.replaceAll('_', ' ')

  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">{agentName}</h1>
        <p className="mt-2 text-sm text-slate-600">Latest insights, execution traces, and recommendation payload snapshot.</p>
      </header>

      <section className="grid gap-6 lg:grid-cols-2">
        <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Latest Findings</h2>
          <ul className="mt-4 space-y-3 text-sm text-slate-700">
            <li className="rounded-lg bg-slate-50 p-3">High CAC detected on Google Ads compared to Meta Ads.</li>
            <li className="rounded-lg bg-slate-50 p-3">Expected impact: save NGN 450,000 monthly by reallocating budget.</li>
            <li className="rounded-lg bg-slate-50 p-3">Confidence score: 0.82 based on last 30-day conversion data.</li>
          </ul>
        </article>

        <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Execution Metadata</h2>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg bg-slate-50 p-3">
              <dt className="text-slate-500">Run status</dt>
              <dd className="font-semibold text-slate-900">SUCCESS</dd>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <dt className="text-slate-500">Duration</dt>
              <dd className="font-semibold text-slate-900">3.4s</dd>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <dt className="text-slate-500">Token cost</dt>
              <dd className="font-semibold text-slate-900">1,842 tokens</dd>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <dt className="text-slate-500">Last updated</dt>
              <dd className="font-semibold text-slate-900">Just now</dd>
            </div>
          </dl>
        </article>
      </section>
    </div>
  )
}
