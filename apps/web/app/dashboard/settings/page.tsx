export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">Organization Settings</h1>
        <p className="mt-2 text-sm text-slate-600">Manage company profile, timezone, and team roles.</p>
      </header>

      <section className="grid gap-4 md:grid-cols-2">
        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Default Currency</h2>
          <p className="mt-2 text-sm text-slate-600">NGN (Nigerian Naira)</p>
        </article>

        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Default Timezone</h2>
          <p className="mt-2 text-sm text-slate-600">Africa/Lagos</p>
        </article>
      </section>
    </div>
  )
}
