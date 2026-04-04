'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'

type IntegrationSource =
  | 'GA4'
  | 'META_ADS'
  | 'GOOGLE_ADS'
  | 'HUBSPOT'
  | 'PAYSTACK'
  | 'STRIPE'

const SOURCE_OPTIONS: Array<{ value: IntegrationSource; label: string }> = [
  { value: 'GA4', label: 'Google Analytics 4' },
  { value: 'META_ADS', label: 'Meta Ads' },
  { value: 'GOOGLE_ADS', label: 'Google Ads' },
  { value: 'HUBSPOT', label: 'HubSpot' },
  { value: 'PAYSTACK', label: 'Paystack' },
  { value: 'STRIPE', label: 'Stripe' },
]

type IntegrationRecord = {
  id: string
  source: IntegrationSource
  authType: 'OAUTH' | 'API_KEY' | 'WEBHOOK'
  displayName: string
  status: 'ACTIVE' | 'NEEDS_REAUTH' | 'ERROR' | 'DISCONNECTED'
  syncIntervalMinutes: number
  lastSyncAt?: string | null
  errorCount: number
  healthScore: number
}

type SyncHistoryRecord = {
  id: string
  status: 'QUEUED' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'DEAD_LETTER'
  startedAt: string
  finishedAt?: string | null
  recordsIngested: number
  retryCount: number
  errorMessage?: string | null
}

export default function IntegrationsPage() {
  const { data: session } = useSession()

  const [source, setSource] = useState<IntegrationSource>('GA4')
  const [displayName, setDisplayName] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [syncIntervalMinutes, setSyncIntervalMinutes] = useState(60)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [integrations, setIntegrations] = useState<IntegrationRecord[]>([])
  const [selectedIntegrationId, setSelectedIntegrationId] = useState<string>('')
  const [syncHistory, setSyncHistory] = useState<SyncHistoryRecord[]>([])

  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  const accessToken = (session?.user as { accessToken?: string } | undefined)?.accessToken

  const apiFetch = async (path: string, init?: RequestInit): Promise<Response> => {
    if (!accessToken) {
      throw new Error('No access token available')
    }

    const headers = new Headers(init?.headers)
    headers.set('Content-Type', 'application/json')
    headers.set('Authorization', `Bearer ${accessToken}`)

    return fetch(`${apiBase}${path}`, {
      ...init,
      headers,
    })
  }

  const sourceLabel = useMemo(() => {
    return SOURCE_OPTIONS.find((option) => option.value === source)?.label ?? source
  }, [source])

  const selectedIntegration = integrations.find((item) => item.id === selectedIntegrationId)

  const loadIntegrations = async () => {
    if (!accessToken) {
      return
    }

    const response = await apiFetch('/api/v1/integrations')
    if (!response.ok) {
      throw new Error('Failed to load integrations')
    }

    const data = (await response.json()) as {
      data?: IntegrationRecord[]
    }
    const list = data.data ?? []
    setIntegrations(list)
    if (!selectedIntegrationId && list.length > 0) {
      setSelectedIntegrationId(list[0].id)
    }
  }

  const loadSyncHistory = async (integrationId: string) => {
    if (!accessToken || !integrationId) {
      return
    }

    const response = await apiFetch(`/api/v1/integrations/${integrationId}/history`)
    if (!response.ok) {
      setSyncHistory([])
      return
    }

    const data = (await response.json()) as {
      data?: SyncHistoryRecord[]
    }
    setSyncHistory(data.data ?? [])
  }

  useEffect(() => {
    void loadIntegrations()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken])

  useEffect(() => {
    if (selectedIntegrationId) {
      void loadSyncHistory(selectedIntegrationId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIntegrationId, accessToken])

  const handleConnect = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setMessage('')
    setLoading(true)

    try {
      if (source === 'GA4' || source === 'META_ADS' || source === 'GOOGLE_ADS') {
        const oauthResponse = await apiFetch(
          `/api/v1/integrations/oauth/${source}/start?displayName=${encodeURIComponent(displayName || sourceLabel)}&syncIntervalMinutes=${syncIntervalMinutes}`,
        )

        if (!oauthResponse.ok) {
          setMessage('Unable to initialize OAuth flow for this source.')
          return
        }

        const oauthData = (await oauthResponse.json()) as { data?: { url?: string } }
        const oauthUrl = oauthData.data?.url
        if (!oauthUrl) {
          setMessage('OAuth URL missing from server response.')
          return
        }

        window.location.href = oauthUrl
        return
      }

      const response = await apiFetch('/api/v1/integrations/connect', {
        method: 'POST',
        body: JSON.stringify({
          source,
          authType: 'API_KEY',
          displayName: displayName || sourceLabel,
          syncIntervalMinutes,
          credentials: {
            apiKey,
          },
        }),
      })

      if (!response.ok) {
        setMessage('Connection failed. Verify credentials and try again.')
        return
      }

      setMessage(`${sourceLabel} integration connected.`)
      setDisplayName('')
      setApiKey('')
      setSyncIntervalMinutes(60)
      await loadIntegrations()
    } finally {
      setLoading(false)
    }
  }

  const triggerSync = async (integrationId: string) => {
    setMessage('')

    const response = await apiFetch(`/api/v1/integrations/${integrationId}/sync`, {
      method: 'POST',
    })

    if (!response.ok) {
      setMessage('Sync trigger failed.')
      return
    }

    setMessage('Sync queued successfully.')
    await Promise.all([loadIntegrations(), loadSyncHistory(integrationId)])
  }

  const refreshHealth = async (integrationId: string) => {
    const response = await apiFetch(`/api/v1/integrations/${integrationId}/health`)
    if (!response.ok) {
      setMessage('Could not refresh health details.')
      return
    }

    const health = (await response.json()) as {
      data?: {
        id: string
        status: IntegrationRecord['status']
        errorCount: number
        healthScore: number
        lastSyncAt?: string | null
      }
    }

    const record = health.data
    if (!record) {
      return
    }

    setIntegrations((current) =>
      current.map((integration) =>
        integration.id === record.id
          ? {
              ...integration,
              status: record.status,
              errorCount: record.errorCount,
              healthScore: record.healthScore,
              lastSyncAt: record.lastSyncAt,
            }
          : integration,
      ),
    )

    await loadSyncHistory(integrationId)
  }

  return (
    <div className="space-y-8">
      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">Integrations</h1>
        <p className="mt-2 text-sm text-slate-600">
          Connect data sources, run manual sync, and inspect integration health/sync history.
        </p>
      </header>

      <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <form onSubmit={handleConnect} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <h2 className="text-lg font-semibold text-slate-900">Connect New Source</h2>

          <label className="block space-y-2 text-sm">
            <span className="font-medium text-slate-700">Source</span>
            <select
              value={source}
              onChange={(event) => setSource(event.target.value as IntegrationSource)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-slate-500 focus:outline-none"
            >
              {SOURCE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-2 text-sm">
            <span className="font-medium text-slate-700">Display Name</span>
            <input
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder={sourceLabel}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-slate-500 focus:outline-none"
            />
          </label>

          <label className="block space-y-2 text-sm">
            <span className="font-medium text-slate-700">Credential (API key or OAuth token seed)</span>
            <input
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              required={source === 'PAYSTACK' || source === 'HUBSPOT' || source === 'STRIPE'}
              disabled={source === 'GA4' || source === 'META_ADS' || source === 'GOOGLE_ADS'}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-slate-500 focus:outline-none"
              placeholder={
                source === 'GA4' || source === 'META_ADS' || source === 'GOOGLE_ADS'
                  ? 'OAuth flow will be launched on connect'
                  : 'Paste secure credential'
              }
            />
          </label>

          <label className="block space-y-2 text-sm">
            <span className="font-medium text-slate-700">Sync Interval (minutes)</span>
            <input
              type="number"
              min={5}
              max={1440}
              value={syncIntervalMinutes}
              onChange={(event) => setSyncIntervalMinutes(Number(event.target.value) || 60)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-slate-500 focus:outline-none"
            />
          </label>

          <button
            type="submit"
            disabled={!accessToken || loading}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
          >
            {source === 'GA4' || source === 'META_ADS' || source === 'GOOGLE_ADS'
              ? (loading ? 'Launching OAuth...' : 'Connect with OAuth')
              : (loading ? 'Connecting...' : 'Connect Source')}
          </button>

          {message ? <p className="text-sm text-slate-600">{message}</p> : null}
        </form>

        <aside className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Health Criteria</h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-600">
            <li>OAuth/API credentials encrypted at rest</li>
            <li>Scheduled BullMQ sync with retries</li>
            <li>Pipeline transforms into unified MetricRecord schema</li>
            <li>Tenant-scoped metrics and sync history</li>
          </ul>
        </aside>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Connected Integrations</h2>
          <div className="mt-4 space-y-3">
            {integrations.length === 0 ? (
              <p className="text-sm text-slate-500">No integrations connected yet.</p>
            ) : (
              integrations.map((integration) => (
                <div
                  key={integration.id}
                  className={`rounded-lg border p-4 ${
                    selectedIntegrationId === integration.id ? 'border-slate-900' : 'border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{integration.displayName}</p>
                      <p className="text-xs text-slate-500">
                        {integration.source} • {integration.authType} • every {integration.syncIntervalMinutes}m • health {integration.healthScore}
                      </p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-700">
                      {integration.status}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedIntegrationId(integration.id)}
                      className="rounded-md border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700"
                    >
                      View
                    </button>
                    <button
                      type="button"
                      onClick={() => void triggerSync(integration.id)}
                      className="rounded-md bg-slate-900 px-3 py-1 text-xs font-medium text-white"
                    >
                      Sync Now
                    </button>
                    <button
                      type="button"
                      onClick={() => void refreshHealth(integration.id)}
                      className="rounded-md border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700"
                    >
                      Refresh Health
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Sync History</h2>
          {selectedIntegration ? (
            <p className="mt-1 text-xs text-slate-500">{selectedIntegration.displayName}</p>
          ) : null}

          <div className="mt-4 space-y-3">
            {syncHistory.length === 0 ? (
              <p className="text-sm text-slate-500">No sync runs yet for this integration.</p>
            ) : (
              syncHistory.map((run) => (
                <div key={run.id} className="rounded-lg border border-slate-200 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-700">{run.status}</span>
                    <span className="text-xs text-slate-500">{run.recordsIngested} records</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">Started: {new Date(run.startedAt).toLocaleString()}</p>
                  {run.errorMessage ? (
                    <p className="mt-1 text-xs text-red-600">{run.errorMessage}</p>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
