export type AppRole = 'OWNER' | 'ADMIN' | 'ANALYST' | 'VIEWER'

const MANAGER_ROLES: AppRole[] = ['OWNER', 'ADMIN']
const OPERATOR_ROLES: AppRole[] = ['OWNER', 'ADMIN', 'ANALYST']

function normalizeRole(rawRole?: string): AppRole {
  const role = (rawRole ?? '').toUpperCase()
  if (role === 'OWNER' || role === 'ADMIN' || role === 'ANALYST' || role === 'VIEWER') {
    return role
  }

  return 'VIEWER'
}

export function getSessionRole(session: unknown): AppRole {
  const role =
    session && typeof session === 'object' && 'user' in session
      ? ((session as { user?: { role?: string } }).user?.role ?? '')
      : ''

  return normalizeRole(role)
}

export function canTriggerAgents(role: AppRole): boolean {
  return OPERATOR_ROLES.includes(role)
}

export function canManageIntegrations(role: AppRole): boolean {
  return MANAGER_ROLES.includes(role)
}

export function canOperateIntegrations(role: AppRole): boolean {
  return OPERATOR_ROLES.includes(role)
}

export function canManageBilling(role: AppRole): boolean {
  return MANAGER_ROLES.includes(role)
}

export function canManageOnboarding(role: AppRole): boolean {
  return OPERATOR_ROLES.includes(role)
}