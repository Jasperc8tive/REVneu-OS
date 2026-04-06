import { ReactNode } from 'react'

type ChartContainerProps = {
  title: string
  description: string
  children: ReactNode
  actions?: ReactNode
}

export function ChartContainer({ title, description, children, actions }: ChartContainerProps) {
  return (
    <article className="rounded-2xl border border-[var(--border-muted)] bg-[var(--bg-panel)] p-5 shadow-sm sm:p-6">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900">{title}</h2>
          <p className="mt-1 text-xs text-slate-500">{description}</p>
        </div>
        {actions ? <div>{actions}</div> : null}
      </div>
      {children}
    </article>
  )
}
