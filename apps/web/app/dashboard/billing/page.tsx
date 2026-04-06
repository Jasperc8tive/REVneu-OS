'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { canManageBilling, getSessionRole } from '@/lib/rbac'
import { ChartContainer } from '@/components/ui/chart-container'
import { MetricCard } from '@/components/ui/metric-card'
import { resolveApiBaseUrl } from '@/lib/api-base-url'
import { formatNaira } from '@/lib/formatters'

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
  status: 'ACTIVE' | 'INACTIVE' | 'PAST_DUE' | 'CANCELED' | 'TRIAL'
  currentPeriodStart: string
  currentPeriodEnd: string
  billedAt?: string | null
  nextBillingDate?: string | null
  amountPaid: number
  currency: string
}

type UsageSummary = {
  tier: string
  status: string
  limits: {
    maxUsers: number
    maxIntegrations: number
    maxAgents: number
  }
  usage: {
    users: number
    integrations: number
    agents: number
    agentRunsWindow?: number
    apiCallsWindow?: number
    windowDays?: number
  }
}

type Invoice = {
  id: string
  date: string
  amount: number
  currency: string
  status: string
  url?: string
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
  const { data: session, status } = useSession()
  const role = getSessionRole(session)
  const canStartCheckout = canManageBilling(role)
  const apiBase = resolveApiBaseUrl()
  const accessToken = (session?.user as { accessToken?: string } | undefined)?.accessToken

  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [plans, setPlans] = useState<BillingPlan[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [usage, setUsage] = useState<UsageSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null)
  const [downloadingInvoiceId, setDownloadingInvoiceId] = useState<string | null>(null)

  useEffect(() => {
    if (status === 'loading') {
      return
    }

    if (!accessToken) {
      setLoading(false)
      setError('Your session has expired. Please sign in again.')
      return
    }

    const headers = new Headers()
    headers.set('Authorization', `Bearer ${accessToken}`)
    headers.set('Content-Type', 'application/json')

    async function loadBillingData() {
      setLoading(true)
      setError('')
      try {
        const [subRes, plansRes, invoicesRes, usageRes] = await Promise.all([
          fetch(`${apiBase}/api/v1/billing/subscription`, { headers }),
          fetch(`${apiBase}/api/v1/billing/plans`, { headers }),
          fetch(`${apiBase}/api/v1/billing/invoices`, { headers }),
          fetch(`${apiBase}/api/v1/billing/usage`, { headers }),
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

        if (usageRes.ok) {
          const usagePayload = await usageRes.json()
          const usageData =
            usagePayload && typeof usagePayload === 'object' && 'data' in usagePayload
              ? ((usagePayload as { data?: UsageSummary | null }).data ?? null)
              : (usagePayload as UsageSummary)
          setUsage(usageData)
        }
      } catch {
        setError('Unable to load billing data right now.')
      } finally {
        setLoading(false)
      }
    }

    void loadBillingData()
  }, [accessToken, apiBase, status])

  async function startCheckout(planId: string, provider: 'paystack' | 'stripe') {
    if (!canStartCheckout) {
      setError('Your role does not allow plan upgrades.')
      return
    }

    if (!accessToken || !session?.user?.email) {
      setError('Missing user session for checkout.')
      return
    }

    setCheckoutLoading(`${provider}:${planId}`)
    setError('')

    try {
      const response = await fetch(`${apiBase}/api/v1/billing/checkout/${provider}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          planId,
          email: session.user.email,
          callbackUrl: `${window.location.origin}/dashboard/billing`,
        }),
      })

      if (!response.ok) {
        throw new Error('Checkout initialization failed')
      }

      const payload = await response.json()
      const data = payload && typeof payload === 'object' && 'data' in payload
        ? (payload as { data?: { checkoutUrl?: string } }).data
        : (payload as { checkoutUrl?: string })

      if (!data?.checkoutUrl) {
        throw new Error('Checkout URL missing')
      }

      window.location.href = data.checkoutUrl
    } catch {
      setError('Unable to start checkout right now. Please try again.')
    } finally {
      setCheckoutLoading(null)
    }
  }

  async function downloadInvoicePdf(invoiceId: string) {
    if (!accessToken) {
      setError('Missing user session for invoice download.')
      return
    }

    setDownloadingInvoiceId(invoiceId)
    setError('')

    try {
      const response = await fetch(`${apiBase}/api/v1/billing/invoices/${invoiceId}/pdf`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })

      if (!response.ok) {
        throw new Error('Failed to download invoice')
      }

      const blob = await response.blob()
      const objectUrl = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = objectUrl
      link.download = `invoice-${invoiceId.slice(0, 8)}.pdf`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(objectUrl)
    } catch {
      setError('Unable to download invoice right now. Please try again.')
    } finally {
      setDownloadingInvoiceId(null)
    }
  }

  return (
    <div className="space-y-6">
      <header className="rounded-3xl border border-slate-800/15 bg-gradient-to-r from-slate-900 via-cyan-900 to-teal-800 p-6 text-white shadow-md">
        <p className="text-xs uppercase tracking-[0.14em] text-cyan-100">Billing and Plans</p>
        <h1 className="mt-1 text-3xl font-bold font-display">Revenue Billing Center</h1>
        <p className="mt-2 text-sm text-cyan-100">
          Track plans, consumption, invoices, and checkout upgrades with Nigerian Naira as the primary currency.
        </p>
        <p className="mt-2 text-xs text-cyan-100">Role: {role}. Upgrades are limited to OWNER and ADMIN.</p>
      </header>

      {error ? (
        <section className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {error}
        </section>
      ) : null}

      {loading ? (
        <section className="grid gap-4 md:grid-cols-3">
          <MetricCard label="Current Plan" value="..." delta="Loading" loading trend="neutral" />
          <MetricCard label="Current Spend" value="..." delta="Loading" loading trend="neutral" />
          <MetricCard label="Next Billing" value="..." delta="Loading" loading trend="neutral" />
        </section>
      ) : (
        <>
          <section className="grid gap-4 md:grid-cols-3">
            <MetricCard
              label="Current Plan"
              value={subscription ? subscription.planName : 'Trial'}
              delta={subscription ? subscription.status : '14-day free trial'}
              trend={subscription && subscription.status === 'PAST_DUE' ? 'down' : 'up'}
            />
            <MetricCard
              label="Current Spend"
              value={formatNaira(subscription?.amountPaid ?? 0)}
              delta="Current billing period"
              trend="neutral"
            />
            <MetricCard
              label="Next Billing"
              value={subscription?.nextBillingDate ? formatDate(subscription.nextBillingDate) : 'Not scheduled'}
              delta="Billing schedule"
              trend="neutral"
            />
          </section>

          <ChartContainer title="Available Plans" description="Compare limits and choose your growth package">
            {usage ? (
              <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-700">
                <p>
                  Current tier: <strong>{usage.tier}</strong> ({usage.status})
                </p>
                <p className="mt-1">
                  Usage: {usage.usage.users}/{usage.limits.maxUsers} users, {usage.usage.integrations}/{usage.limits.maxIntegrations} integrations, {usage.usage.agents}/{usage.limits.maxAgents} agents
                </p>
                <p className="mt-1">
                  Metering ({usage.usage.windowDays ?? 30} days): {usage.usage.agentRunsWindow ?? 0} agent runs, {usage.usage.apiCallsWindow ?? 0} API calls
                </p>
              </div>
            ) : null}
            {plans.length === 0 ? (
              <p className="text-sm text-slate-600">
                Plan information not available.
              </p>
            ) : (
              <div className="grid gap-4 md:grid-cols-3">
                {plans.map((plan) => (
                  <article
                    key={plan.id}
                    className="rounded-2xl border border-[var(--border-muted)] bg-white p-5 shadow-sm"
                  >
                    <h3 className="text-base font-semibold text-slate-900">
                      {plan.name}
                    </h3>
                    <p className="mt-2 font-display text-2xl text-slate-900">
                      {formatNaira(plan.priceNgn)}
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
                    <div className="mt-4 flex gap-2">
                      <button
                        type="button"
                        onClick={() => void startCheckout(plan.id, 'paystack')}
                        disabled={checkoutLoading !== null || !canStartCheckout}
                        className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-700 disabled:opacity-50"
                      >
                        {checkoutLoading === `paystack:${plan.id}` ? 'Starting...' : 'Paystack'}
                      </button>
                      <button
                        type="button"
                        onClick={() => void startCheckout(plan.id, 'stripe')}
                        disabled={checkoutLoading !== null || !canStartCheckout}
                        className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                      >
                        {checkoutLoading === `stripe:${plan.id}` ? 'Starting...' : 'Stripe'}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </ChartContainer>

          {invoices.length > 0 ? (
            <ChartContainer title="Invoice History" description="Download invoices and monitor payment status over time">
              <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 bg-slate-50">
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4">Amount</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {invoices.map((invoice) => (
                      <tr key={invoice.id} className="text-slate-800">
                        <td className="py-3 px-4">
                          {formatDate(invoice.date)}
                        </td>
                        <td className="py-3 px-4 font-semibold">
                          {formatNaira(invoice.amount)}
                        </td>
                        <td className="py-3 px-4">
                          <span className="inline-flex rounded px-2 py-1 text-xs font-semibold bg-slate-100 text-slate-700">
                            {invoice.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => void downloadInvoicePdf(invoice.id)}
                            disabled={downloadingInvoiceId === invoice.id}
                            className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                          >
                            {downloadingInvoiceId === invoice.id ? 'Downloading...' : 'Download PDF'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </ChartContainer>
          ) : null}
        </>
      )}
    </div>
  )
}
