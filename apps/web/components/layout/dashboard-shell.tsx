'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState, type ReactNode } from 'react'

const navItems = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Agents', href: '/dashboard/agents' },
  { label: 'Integrations', href: '/dashboard/integrations' },
  { label: 'Metrics', href: '/dashboard/metrics' },
  { label: 'Forecasts', href: '/dashboard/forecasts' },
  { label: 'Recommendations', href: '/dashboard/recommendations' },
  { label: 'Billing', href: '/dashboard/billing' },
  { label: 'Settings', href: '/dashboard/settings' },
]

function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`)
}

function NavLinks({
  pathname,
  onNavigate,
}: {
  pathname: string
  onNavigate?: () => void
}) {
  return (
    <nav className="flex-1 space-y-1 px-4 py-6">
      {navItems.map((item) => {
        const active = isActivePath(pathname, item.href)
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={`flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              active
                ? 'bg-blue-700 text-white'
                : 'text-blue-100 hover:bg-blue-800 hover:text-white'
            }`}
          >
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}

export function DashboardShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="flex min-h-screen">
        <aside className="hidden w-64 shrink-0 flex-col bg-brand-primary text-white lg:flex">
          <div className="border-b border-blue-800 px-6 py-5">
            <span className="text-xl font-bold font-sans">Revneu OS</span>
            <p className="mt-1 text-xs text-blue-200">Growth Control Center</p>
          </div>
          <NavLinks pathname={pathname} />
          <div className="border-t border-blue-800 px-4 py-4">
            <p className="text-xs font-mono text-blue-300">Stage 5 - UI Layer</p>
          </div>
        </aside>

        <div className="flex min-h-screen flex-1 flex-col overflow-hidden">
          <header className="sticky top-0 z-20 border-b border-gray-200 bg-white px-4 py-3 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  aria-label="Open navigation"
                  onClick={() => setMobileOpen(true)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 text-slate-700 lg:hidden"
                >
                  <span className="text-lg leading-none">≡</span>
                </button>
                <div>
                  <p className="text-xs text-slate-500">Timezone: Africa/Lagos</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="hidden text-sm text-gray-500 sm:inline">Growth trial active</span>
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-primary text-sm font-bold text-white">
                  R
                </div>
              </div>
            </div>
          </header>
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
          <aside className="relative h-full w-72 max-w-[85vw] bg-brand-primary text-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-blue-800 px-5 py-4">
              <div>
                <p className="text-base font-bold">Revneu OS</p>
                <p className="text-xs text-blue-200">Navigation</p>
              </div>
              <button
                type="button"
                aria-label="Close navigation"
                onClick={() => setMobileOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-blue-600 text-blue-100"
              >
                ×
              </button>
            </div>
            <NavLinks pathname={pathname} onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      ) : null}
    </div>
  )
}