const steps = [
  'Create organization profile',
  'Invite your team',
  'Connect integrations',
  'Run all 7 agents',
  'Review recommendations and set actions',
]

export default function OnboardingPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <section className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">Onboarding Wizard</h1>
        <p className="mt-2 text-sm text-slate-600">
          Complete the setup checklist to unlock the full Growth Control Center experience.
        </p>

        <ol className="mt-6 space-y-3">
          {steps.map((step, index) => (
            <li key={step} className="rounded-lg border border-slate-200 p-4 text-sm text-slate-800">
              <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-brand-primary text-xs font-bold text-white">
                {index + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
      </section>
    </main>
  )
}
