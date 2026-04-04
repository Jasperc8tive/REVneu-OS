const plans = [
  { name: 'Starter', price: 'NGN 49,000/mo', users: '3 users', integrations: '2 integrations' },
  { name: 'Growth', price: 'NGN 150,000/mo', users: '10 users', integrations: '6 integrations' },
  { name: 'Scale', price: 'NGN 450,000/mo', users: '25 users', integrations: 'Unlimited' },
]

export default function BillingPage() {
  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">Billing</h1>
        <p className="mt-2 text-sm text-slate-600">Track plan, usage, and upgrade options for your organization.</p>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        {plans.map((plan) => (
          <article key={plan.name} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">{plan.name}</h2>
            <p className="mt-2 font-mono text-lg text-slate-900">{plan.price}</p>
            <p className="mt-2 text-sm text-slate-600">{plan.users}</p>
            <p className="text-sm text-slate-600">{plan.integrations}</p>
          </article>
        ))}
      </section>
    </div>
  )
}
