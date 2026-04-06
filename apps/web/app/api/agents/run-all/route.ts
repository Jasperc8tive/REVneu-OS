import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'

export async function POST(request: NextRequest) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const role = String(token.role ?? 'VIEWER').toUpperCase()
  const organizationId = String(token.organizationId ?? '')
  if (!organizationId) {
    return NextResponse.json({ error: 'Missing organization context' }, { status: 400 })
  }

  if (role === 'VIEWER') {
    return NextResponse.json({ error: 'Forbidden for VIEWER role' }, { status: 403 })
  }

  const agentServiceUrl = process.env.AGENT_SERVICE_URL ?? 'http://localhost:8000'
  const agentApiKey = process.env.AGENT_API_KEY

  if (!agentApiKey) {
    return NextResponse.json({ error: 'AGENT_API_KEY is not configured' }, { status: 500 })
  }

  const payload = (await request.json().catch(() => ({}))) as { period?: string }
  const period = payload.period ?? 'last_30_days'

  const upstreamResponse = await fetch(`${agentServiceUrl}/api/v1/agents/run-all`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-agent-api-key': agentApiKey,
    },
    body: JSON.stringify({
      tenant_id: organizationId,
      period,
    }),
  })

  const upstreamData = await upstreamResponse.json().catch(() => ({}))

  if (!upstreamResponse.ok) {
    return NextResponse.json(
      {
        error: 'Failed to trigger run-all in agent service',
        details: upstreamData,
      },
      { status: upstreamResponse.status },
    )
  }

  return NextResponse.json(upstreamData, { status: 200 })
}