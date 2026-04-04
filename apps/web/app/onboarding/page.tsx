'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

type OnboardingStep =
  | 'org_profile'
  | 'invite_team'
  | 'connect_integrations'
  | 'run_agents'
  | 'review_recommendations'

type OnboardingProgress = {
  currentStep: OnboardingStep
  completedSteps: OnboardingStep[]
  progressPercent: number
}

const STEPS: Array<{
  key: OnboardingStep
  label: string
  description: string
}> = [
  {
    key: 'org_profile',
    label: 'Create organization profile',
    description:
      'Set up your company name, timezone, and currency preferences.',
  },
  {
    key: 'invite_team',
    label: 'Invite your team',
    description: 'Add team members with appropriate roles.',
  },
  {
    key: 'connect_integrations',
    label: 'Connect integrations',
    description:
      'Link GA4, Meta Ads, Paystack, and other data sources.',
  },
  {
    key: 'run_agents',
    label: 'Run all 7 agents',
    description:
      'Execute the AI agents to generate first recommendations.',
  },
  {
    key: 'review_recommendations',
    label: 'Review recommendations and set actions',
    description:
      'Inspect AI insights and plan your revenue optimization actions.',
  },
]

function unwrapData<T>(payload: unknown): T {
  if (payload && typeof payload === 'object' && 'data' in payload) {
    return (payload as { data: T }).data
  }

  return payload as T
}

export default function OnboardingPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  const accessToken = (session?.user as { accessToken?: string } | undefined)?.accessToken

  const [progress, setProgress] = useState<OnboardingProgress | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [completingStep, setCompletingStep] = useState<OnboardingStep | null>(
    null,
  )

  useEffect(() => {
    if (!accessToken) {
      return
    }

    const headers = new Headers()
    headers.set('Authorization', `Bearer ${accessToken}`)
    headers.set('Content-Type', 'application/json')

    async function loadProgress() {
      setLoading(true)
      setError('')
      try {
        const res = await fetch(
          `${apiBase}/api/v1/onboarding/progress`,
          { headers },
        )

        if (!res.ok) {
          throw new Error('Failed to load onboarding progress')
        }

        const data = unwrapData<OnboardingProgress>(await res.json())
        setProgress(data)

        // Redirect to dashboard if onboarding is complete
        if (data.completedSteps.length === STEPS.length) {
          router.push('/dashboard')
        }
      } catch {
        // If endpoint doesn't exist yet, show all steps incomplete
        setProgress({
          currentStep: STEPS[0].key,
          completedSteps: [],
          progressPercent: 0,
        })
      } finally {
        setLoading(false)
      }
    }

    void loadProgress()
  }, [accessToken, apiBase, router])

  const completeStep = async (step: OnboardingStep) => {
    if (!accessToken) {
      return
    }

    setCompletingStep(step)
    const headers = new Headers()
    headers.set('Authorization', `Bearer ${accessToken}`)
    headers.set('Content-Type', 'application/json')

    try {
      const res = await fetch(
        `${apiBase}/api/v1/onboarding/complete/${step}`,
        { method: 'POST', headers },
      )

      if (!res.ok) {
        setError(`Failed to complete step: ${step}`)
        return
      }

      const data = unwrapData<OnboardingProgress>(await res.json())
      setProgress(data)

      // Redirect if complete
      if (data.completedSteps.length === STEPS.length) {
        router.push('/dashboard')
      }
    } catch {
      setError(`Error completing step: ${step}`)
    } finally {
      setCompletingStep(null)
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-10">
        <section className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm text-center">
          <p className="text-slate-600">Loading onboarding...</p>
        </section>
      </main>
    )
  }

  if (!progress) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-10">
        <section className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <p className="text-sm text-slate-600">{error || 'Unable to load onboarding.'}</p>
        </section>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <section className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Onboarding Wizard
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Complete the setup checklist to unlock the full Growth Control
              Center experience.
            </p>
          </div>
          <div className="flex-shrink-0">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-100">
              <span className="text-xl font-bold text-emerald-700">
                {progress.progressPercent}%
              </span>
            </div>
          </div>
        </div>

        {error ? (
          <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        <div className="mb-6">
          <progress
            className="h-2 w-full overflow-hidden rounded-full [&::-webkit-progress-bar]:bg-slate-100 [&::-webkit-progress-value]:bg-emerald-500 [&::-moz-progress-bar]:bg-emerald-500"
            max={100}
            value={Math.max(0, Math.min(100, progress.progressPercent))}
          />
        </div>

        <ol className="space-y-3">
          {STEPS.map((step, index) => {
            const isCompleted = progress.completedSteps.includes(step.key)
            const isActive = progress.currentStep === step.key

            return (
              <li
                key={step.key}
                className={`rounded-lg border p-4 transition-all ${
                  isCompleted
                    ? 'border-emerald-200 bg-emerald-50'
                    : isActive
                      ? 'border-slate-400 bg-slate-50'
                      : 'border-slate-200 bg-white'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0">
                    {isCompleted ? (
                      <div className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500 text-white">
                        <span>✓</span>
                      </div>
                    ) : (
                      <div className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-300 text-slate-700 font-semibold">
                        {index + 1}
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <h3
                      className={`font-semibold ${
                        isCompleted ? 'text-emerald-900' : 'text-slate-900'
                      }`}
                    >
                      {step.label}
                    </h3>
                    <p
                      className={`mt-1 text-sm ${
                        isCompleted
                          ? 'text-emerald-700'
                          : 'text-slate-600'
                      }`}
                    >
                      {step.description}
                    </p>
                    {!isCompleted && (
                      <button
                        type="button"
                        disabled={!isActive || completingStep === step.key}
                        onClick={() => void completeStep(step.key)}
                        className={`mt-3 inline-flex rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                          isActive
                            ? 'bg-slate-900 text-white hover:bg-slate-700 disabled:opacity-50'
                            : 'bg-slate-100 text-slate-500 cursor-not-allowed'
                        }`}
                      >
                        {completingStep === step.key
                          ? 'Completing...'
                          : 'Mark Complete'}
                      </button>
                    )}
                  </div>
                </div>
              </li>
            )
          })}
        </ol>
      </section>
    </main>
  )
}
