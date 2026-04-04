export default function DashboardPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 font-sans">Growth Dashboard</h1>
        <p className="text-gray-500 mt-1 text-sm">
          Real-time revenue intelligence for your business
        </p>
      </div>

      {/* KPI Cards — populated in Stage 5 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {[
          { label: 'Monthly Revenue', value: '₦—', change: '— ' },
          { label: 'Customer Acquisition Cost', value: '₦—', change: '—' },
          { label: 'Active Customers', value: '—', change: '—' },
          { label: 'Churn Rate', value: '—%', change: '—' },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-white rounded-xl border border-gray-200 p-6">
            <p className="text-sm font-medium text-gray-500 mb-1">{kpi.label}</p>
            <p className="text-2xl font-bold text-gray-900 font-mono">{kpi.value}</p>
            <p className="text-xs text-gray-400 mt-1">{kpi.change} vs last month</p>
          </div>
        ))}
      </div>

      {/* Agent Status — populated in Stage 5 */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">AI Agent Status</h2>
        <div className="space-y-3">
          {[
            'Marketing Performance',
            'Customer Acquisition',
            'Sales Pipeline',
            'Revenue Forecasting',
            'Pricing Optimization',
            'Customer Retention',
            'Growth Opportunity',
          ].map((agent) => (
            <div key={agent} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
              <span className="text-sm font-medium text-gray-700">{agent} Agent</span>
              <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded-full font-mono">
                Pending — Stage 4
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
