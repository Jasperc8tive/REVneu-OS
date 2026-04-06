'use client'

type TopNavbarProps = {
  title: string
  subtitle: string
  onOpenSidebar: () => void
}

export function TopNavbar({ title, subtitle, onOpenSidebar }: TopNavbarProps) {
  return (
    <header className="sticky top-0 z-20 border-b border-[var(--border-muted)] bg-white/90 px-4 py-3 backdrop-blur sm:px-6 lg:px-8">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label="Open navigation"
            onClick={onOpenSidebar}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 text-slate-700 lg:hidden"
          >
            <span className="text-lg leading-none">≡</span>
          </button>
          <div>
            <p className="text-lg font-bold font-display text-slate-900">{title}</p>
            <p className="text-xs text-slate-500">{subtitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 sm:inline-flex">
            Live sync active
          </span>
          <div className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[var(--brand-primary)] text-sm font-bold text-white">
            RG
          </div>
        </div>
      </div>
    </header>
  )
}
