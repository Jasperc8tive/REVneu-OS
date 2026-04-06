'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { SidebarNav, type NavSection } from '@/components/ui/sidebar-nav'
import { TopNavbar } from '@/components/ui/top-navbar'

const navSections: NavSection[] = [
  {
    title: 'Dashboard',
    href: '/dashboard',
    subNav: [
      { label: 'Growth Control Center', href: '/dashboard' },
      { label: 'Executive Snapshot', href: '/dashboard/reports' },
    ],
  },
  {
    title: 'Revenue Analytics',
    href: '/dashboard/revenue-analytics',
    subNav: [
      { label: 'Revenue Trend', href: '/dashboard/revenue-analytics' },
      { label: 'Forecasts', href: '/dashboard/forecasts' },
    ],
  },
  {
    title: 'Customer Acquisition',
    href: '/dashboard/customer-acquisition',
    subNav: [
      { label: 'Channel Mix', href: '/dashboard/customer-acquisition' },
      { label: 'Metrics Explorer', href: '/dashboard/metrics' },
    ],
  },
  {
    title: 'Sales Pipeline',
    href: '/dashboard/sales-pipeline',
    subNav: [{ label: 'Pipeline Funnel', href: '/dashboard/sales-pipeline' }],
  },
  {
    title: 'Retention Intelligence',
    href: '/dashboard/retention-intelligence',
    subNav: [
      { label: 'Cohort Health', href: '/dashboard/retention-intelligence' },
      { label: 'Recommendations', href: '/dashboard/recommendations' },
    ],
  },
  {
    title: 'AI Growth Agents',
    href: '/dashboard/ai-growth-agents',
    subNav: [
      { label: 'Agent Board', href: '/dashboard/ai-growth-agents' },
      { label: 'Run History', href: '/dashboard/agents' },
    ],
  },
  {
    title: 'Integrations',
    href: '/dashboard/integrations',
    subNav: [{ label: 'Sources and Sync', href: '/dashboard/integrations' }],
  },
  {
    title: 'Reports',
    href: '/dashboard/reports',
    subNav: [{ label: 'Board Reports', href: '/dashboard/reports' }],
  },
  {
    title: 'Billing',
    href: '/dashboard/billing',
    subNav: [{ label: 'Plan and Usage', href: '/dashboard/billing' }],
  },
  {
    title: 'Settings',
    href: '/dashboard/settings',
    subNav: [{ label: 'Organization', href: '/dashboard/settings' }],
  },
]

export function DashboardShell({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    setMobileOpen(false)
  }, [])

  return (
    <div className="min-h-screen bg-transparent">
      <div className="flex min-h-screen">
        <aside
          className={`hidden shrink-0 flex-col border-r border-slate-800 bg-slate-900 text-white transition-all lg:flex ${
            collapsed ? 'w-24' : 'w-[19rem]'
          }`}
        >
          <div className="flex items-center justify-between border-b border-slate-700 px-4 py-4">
            <div className={collapsed ? 'hidden' : 'block'}>
              <p className="text-xl font-bold font-display">Revenue Growth OS</p>
              <p className="mt-1 text-xs text-slate-300">Growth intelligence for Nigeria</p>
            </div>
            <button
              type="button"
              aria-label="Toggle sidebar"
              onClick={() => setCollapsed((current) => !current)}
              className="rounded-md border border-slate-600 px-2 py-1 text-xs text-slate-200"
            >
              {collapsed ? '>>' : '<<'}
            </button>
          </div>
          {collapsed ? null : <SidebarNav sections={navSections} />}
        </aside>

        <div className="flex min-h-screen flex-1 flex-col overflow-hidden">
          <TopNavbar
            title="Growth Control Center"
            subtitle="Africa/Lagos timezone · Nigerian Naira default"
            onOpenSidebar={() => setMobileOpen(true)}
          />
          <main className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">{children}</main>
        </div>
      </div>

      {mobileOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation overlay"
            onClick={() => setMobileOpen(false)}
            className="absolute inset-0 bg-slate-950/35"
          />
          <aside className="relative h-full w-80 max-w-[88vw] bg-slate-900 text-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-700 px-5 py-4">
              <div>
                <p className="text-base font-bold font-display">Revenue Growth OS</p>
                <p className="text-xs text-slate-300">Navigation</p>
              </div>
              <button
                type="button"
                aria-label="Close navigation"
                onClick={() => setMobileOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-600 text-slate-100"
              >
                ×
              </button>
            </div>
            <SidebarNav sections={navSections} onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      ) : null}
    </div>
  )
}