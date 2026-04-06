'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { ChartContainer } from '@/components/ui/chart-container'
import { MetricCard } from '@/components/ui/metric-card'
import { resolveApiBaseUrl } from '@/lib/api-base-url'

type Organization = {
  id: string
  name: string
  defaultCurrency: string
  defaultTimezone: string
  createdAt: string
}

type User = {
  id: string
  email: string
  name?: string | null
  role: string
  createdAt: string
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

function formatDate(isoDate: string): string {
  try {
    return new Intl.DateTimeFormat('en-NG', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(new Date(isoDate))
  } catch {
    return isoDate
  }
}

export default function SettingsPage() {
  const { data: session } = useSession()
  const apiBase = resolveApiBaseUrl()
  const accessToken = (session?.user as { accessToken?: string } | undefined)?.accessToken
  const organizationId = (session?.user as { organizationId?: string } | undefined)?.organizationId

  const [org, setOrg] = useState<Organization | null>(null)
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!accessToken || !organizationId) {
      return
    }

    const headers = new Headers()
    headers.set('Authorization', `Bearer ${accessToken}`)
    headers.set('Content-Type', 'application/json')

    async function loadSettings() {
      setLoading(true)
      setError('')
      try {
        const [orgRes, usersRes] = await Promise.all([
          fetch(`${apiBase}/api/v1/organizations/${organizationId}`, { headers }),
          fetch(`${apiBase}/api/v1/users/team`, { headers }),
        ])

        if (!orgRes.ok || !usersRes.ok) {
          throw new Error('Failed to load organization data')
        }

        const [orgPayload, usersPayload] = await Promise.all([
          orgRes.json(),
          usersRes.json(),
        ])

        // Get first org or from payload
        const orgData =
          orgPayload && typeof orgPayload === 'object' && 'data' in orgPayload
            ? ((orgPayload as { data?: Organization }).data ?? null)
            : ((orgPayload as Organization) || null)
        if (orgData) {
          setOrg(orgData)
        }

        const usersList = asList<User>(usersPayload)
        setUsers(usersList)
      } catch {
        setError('Unable to load organization settings right now.')
      } finally {
        setLoading(false)
      }
    }

    void loadSettings()
  }, [accessToken, apiBase, organizationId])

  return (
    <div className="space-y-6">
      <header className="rounded-3xl border border-slate-800/15 bg-gradient-to-r from-slate-900 via-cyan-900 to-teal-800 p-6 text-white shadow-md">
        <p className="text-xs uppercase tracking-[0.14em] text-cyan-100">Organization Settings</p>
        <h1 className="mt-1 text-3xl font-bold font-display">Admin Configuration Console</h1>
        <p className="mt-2 text-sm text-cyan-100">
          Manage company profile, default financial settings, timezone, and team role structure.
        </p>
      </header>

      {error ? (
        <section className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {error}
        </section>
      ) : null}

      {loading ? (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Organization" value="..." delta="Loading" loading trend="neutral" />
          <MetricCard label="Currency" value="..." delta="Loading" loading trend="neutral" />
          <MetricCard label="Timezone" value="..." delta="Loading" loading trend="neutral" />
          <MetricCard label="Team Members" value="..." delta="Loading" loading trend="neutral" />
        </section>
      ) : (
        <>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Organization" value={org?.name || 'Not set'} delta="Profile" trend="neutral" />
            <MetricCard label="Default Currency" value={org?.defaultCurrency || 'NGN'} delta="Nigerian Naira" trend="neutral" />
            <MetricCard label="Default Timezone" value={org?.defaultTimezone || 'Africa/Lagos'} delta="Operational timezone" trend="neutral" />
            <MetricCard label="Team Members" value={`${users.length}`} delta="Active users" trend="up" />
          </section>

          <ChartContainer title={`Team Members (${users.length})`} description={`Organization created ${org ? formatDate(org.createdAt) : 'Unknown'}`}>
            {users.length === 0 ? (
              <p className="mt-3 text-sm text-slate-600">
                No team members yet.
              </p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 bg-slate-50">
                      <th className="py-2 px-4">Name</th>
                      <th className="py-2 px-4">Email</th>
                      <th className="py-2 px-4">Role</th>
                      <th className="py-2 px-4">Joined</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {users.map((user) => (
                      <tr key={user.id} className="text-slate-800">
                        <td className="py-3 px-4 font-medium">
                          {user.name || 'Unnamed'}
                        </td>
                        <td className="py-3 px-4 text-slate-600">
                          {user.email}
                        </td>
                        <td className="py-3 px-4">
                          <span className="inline-flex rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-900">
                            {user.role}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-500">
                          {formatDate(user.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </ChartContainer>
        </>
      )}
    </div>
  )
}
