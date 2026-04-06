'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export type NavSection = {
  title: string
  href: string
  subNav: Array<{ label: string; href: string }>
}

function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function SidebarNav({ sections, onNavigate }: { sections: NavSection[]; onNavigate?: () => void }) {
  const pathname = usePathname()

  return (
    <nav className="space-y-3 px-3 py-4" aria-label="Dashboard navigation">
      {sections.map((section) => {
        const active = isActivePath(pathname, section.href)
        return (
          <div key={section.href} className="rounded-xl border border-white/10 bg-white/5 p-2">
            <Link
              href={section.href}
              onClick={onNavigate}
              className={`block rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                active ? 'bg-white text-slate-900' : 'text-slate-100 hover:bg-white/10'
              }`}
            >
              {section.title}
            </Link>
            <ul className="mt-1 space-y-1">
              {section.subNav.map((item) => {
                const subActive = isActivePath(pathname, item.href)
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      className={`block rounded-md px-3 py-1.5 text-xs transition-colors ${
                        subActive ? 'text-white' : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      {item.label}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        )
      })}
    </nav>
  )
}
