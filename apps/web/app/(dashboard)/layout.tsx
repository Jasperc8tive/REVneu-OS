export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-100 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-brand-primary text-white flex flex-col shrink-0">
        <div className="px-6 py-5 border-b border-blue-800">
          <span className="text-xl font-bold font-sans">Revneu OS</span>
        </div>
        <nav className="flex-1 px-4 py-6 space-y-1">
          {[
            { label: 'Dashboard', href: '/dashboard' },
            { label: 'AI Agents', href: '/dashboard/agents' },
            { label: 'Integrations', href: '/dashboard/integrations' },
            { label: 'Metrics', href: '/dashboard/metrics' },
            { label: 'Recommendations', href: '/dashboard/recommendations' },
            { label: 'Billing', href: '/dashboard/billing' },
            { label: 'Settings', href: '/dashboard/settings' },
          ].map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="flex items-center px-3 py-2 rounded-lg text-sm font-medium text-blue-100 hover:bg-blue-800 hover:text-white transition-colors"
            >
              {item.label}
            </a>
          ))}
        </nav>
        <div className="px-4 py-4 border-t border-blue-800">
          <p className="text-xs text-blue-300 font-mono">Stage 1 — Foundation ✓</p>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between">
          <div />
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">14-day trial active</span>
            <div className="w-8 h-8 bg-brand-primary rounded-full flex items-center justify-center text-white text-sm font-bold">
              R
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-auto p-8">{children}</main>
      </div>
    </div>
  )
}
