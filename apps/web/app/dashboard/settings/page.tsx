'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'

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
  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
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
      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">Organization Settings</h1>
        <p className="mt-2 text-sm text-slate-600">
          Manage company profile, timezone, and team roles.
        </p>
      </header>

      {error ? (
        <section className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {error}
        </section>
      ) : null}

      {loading ? (
        <section className="rounded-xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-600">
          Loading settings...
        </section>
      ) : (
        <>
          <section className="grid gap-4 md:grid-cols-2">
            <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-900">
                Organization Name
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                {org?.name || 'Not set'}
              </p>
            </article>

            <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-900">
                Default Currency
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                {org?.defaultCurrency || 'NGN (Nigerian Naira)'}
              </p>
            </article>

            <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-900">
                Default Timezone
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                {org?.defaultTimezone || 'Africa/Lagos'}
              </p>
            </article>

            <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-900">
                Created
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                {org ? formatDate(org.createdAt) : 'Unknown'}
              </p>
            </article>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">
              Team Members ({users.length})
            </h2>
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
          </section>
        </>
      )}
    </div>
  )
}
