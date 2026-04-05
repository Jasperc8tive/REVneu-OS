function isInternalHost(hostname: string): boolean {
  const host = hostname.toLowerCase()

  if (host === 'localhost' || host === '127.0.0.1' || host === '::1') {
    return true
  }

  return !host.includes('.') && /^[a-z0-9-]+$/i.test(host)
}

export function resolveApiBaseUrl(): string {
  const configured = (
    process.env.API_URL
    ?? process.env.NEXT_PUBLIC_API_URL
    ?? 'http://localhost:4000'
  ).trim()

  try {
    const url = new URL(configured)
    const isProduction = (process.env.NODE_ENV ?? 'development') === 'production'

    if (url.protocol === 'https:' && isInternalHost(url.hostname) && !isProduction) {
      url.protocol = 'http:'
    }

    return url.origin
  } catch {
    return 'http://localhost:4000'
  }
}
