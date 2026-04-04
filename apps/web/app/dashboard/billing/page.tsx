'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'

type BillingPlan = {
  id: string
  name: string
  priceNgn: number
  priceUsd?: number
  maxUsers: number
  maxIntegrations: number
  maxAgents: number
  description?: string
}

type Subscription = {
  id: string
  organizationId: string
  planId: string
  planName: string
  status: 'ACTIVE' | 'INACTIVE' | 'PAST_DUE' | 'CANCELED'
  currentPeriodStart: string
  currentPeriodEnd: string
  billedAt?: string | null
  nextBillingDate?: string | null
  amountPaid: number
  currency: string
}

type Invoice = {
  id: string
  date: string
  amount: number
  currency: string
  status: string
  url?: string
}

function formatNgn(value: number): string {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 0,
  }).format(value)
}

function formatDate(isoDate: string): string {
  try {
    return new Intl.DateTimeFormat('en-NG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(new Date(isoDate))
  } catch {
    return isoDate
  }
}

function asList<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) {
    return payload as T[]
  }

  if (payload && typeof payload === 'object' && 'data' in payload) {
    const wrapped = (payload as { data?: unknown }).data
    return Array.isArray(wrapped) ? (wrapped as T[]) : []
  }

  return []
}

export default function BillingPage() {
  const { data: session } = useSession()
  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  const accessToken = (session?.user as { accessToken?: string } | undefined)?.accessToken

  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [plans, setPlans] = useState<BillingPlan[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!accessToken) {
      return
    }

    const headers = new Headers()
    headers.set('Authorization', `Bearer ${accessToken}`)
    headers.set('Content-Type', 'application/json')

    async function loadBillingData() {
      setLoading(true)
      setError('')
      try {
        const [subRes, plansRes, invoicesRes] = await Promise.all([
          fetch(`${apiBase}/api/v1/billing/subscription`, { headers }),
          fetch(`${apiBase}/api/v1/billing/plans`, { headers }),
          fetch(`${apiBase}/api/v1/billing/invoices`, { headers }),
        ])

        if (!subRes.ok && subRes.status !== 404) {
          throw new Error('Failed to load subscription')
        }

        if (subRes.status === 200) {
          const subPayload = await subRes.json()
          const subscriptionData =
            subPayload && typeof subPayload === 'object' && 'data' in subPayload
              ? ((subPayload as { data?: Subscription | null }).data ?? null)
              : (subPayload as Subscription)
          setSubscription(subscriptionData)
        }

        if (plansRes.ok) {
          const plansPayload = await plansRes.json()
          const plansList = asList<BillingPlan>(plansPayload)
          setPlans(plansList)
        }

        if (invoicesRes.ok) {
          const invoicesPayload = await invoicesRes.json()
          const invoicesList = asList<Invoice>(invoicesPayload)
          setInvoices(invoicesList)
        }
      } catch {
        setError('Unable to load billing data right now.')
      } finally {
        setLoading(false)
      }
    }

    void loadBillingData()
  }, [accessToken, apiBase])

  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">Billing</h1>
        <p className="mt-2 text-sm text-slate-600">
          Track plan, usage, and upgrade options for your organization.
        </p>
      </header>

      {error ? (
        <section className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {error}
        </section>
      ) : null}

      {loading ? (
        <section className="rounded-xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-600">
          Loading billing information...
        </section>
      ) : (
        <>
          {subscription ? (
            <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-emerald-900">
                Current Plan
              </h2>
              <p className="mt-2 text-sm text-emerald-800">
                <strong>{subscription.planName}</strong> — Status:{' '}
                <span className="font-semibold capitalize">
                  {subscription.status}
                </span>
              </p>
              {subscription.nextBillingDate ? (
                <p className="mt-1 text-xs text-emerald-700">
                  Next billing: {formatDate(subscription.nextBillingDate)}
                </p>
              ) : null}
            </section>
          ) : (
            <section className="rounded-xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
              <p className="text-sm text-amber-900">
                You are on a <strong>free trial</strong> (14 days).
              </p>
            </section>
          )}

          <section>
            <h2 className="text-lg font-semibold text-slate-900 mb-4">
              Available Plans
            </h2>
            {plans.length === 0 ? (
              <p className="text-sm text-slate-600">
                Plan information not available.
              </p>
            ) : (
              <div className="grid gap-4 md:grid-cols-3">
                {plans.map((plan) => (
                  <article
                    key={plan.id}
                    className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
                  >
                    <h3 className="text-base font-semibold text-slate-900">
                      {plan.name}
                    </h3>
                    <p className="mt-2 font-mono text-lg text-slate-900">
                      {formatNgn(plan.priceNgn)}
                      <span className="text-xs text-slate-500 font-normal">
                        /mo
                      </span>
                    </p>
                    <ul className="mt-3 space-y-1 text-xs text-slate-700">
                      <li>
                        <strong>{plan.maxUsers}</strong> users
                      </li>
                      <li>
                        <strong>{plan.maxIntegrations}</strong> integrations
                      </li>
                      <li>
                        <strong>{plan.maxAgents}</strong> agents
                      </li>
                    </ul>
                    {plan.description ? (
                      <p className="mt-3 text-xs text-slate-600">
                        {plan.description}
                      </p>
                    ) : null}
                  </article>
                ))}
              </div>
            )}
          </section>

          {invoices.length > 0 ? (
            <section>
              <h2 className="text-lg font-semibold text-slate-900 mb-4">
                Invoice History
              </h2>
              <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 bg-slate-50">
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4">Amount</th>
                      <th className="py-3 px-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {invoices.map((invoice) => (
                      <tr key={invoice.id} className="text-slate-800">
                        <td className="py-3 px-4">
                          {formatDate(invoice.date)}
                        </td>
                        <td className="py-3 px-4 font-semibold">
                          {formatNgn(invoice.amount)}
                        </td>
                        <td className="py-3 px-4">
                          <span className="inline-flex rounded px-2 py-1 text-xs font-semibold bg-slate-100 text-slate-700">
                            {invoice.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}
        </>
      )}
    </div>
  )
}
