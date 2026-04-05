import { NextRequest, NextResponse } from 'next/server'

const protectedRoutes = ['/dashboard', '/settings', '/team']
const publicRoutes = ['/login', '/register', '/auth/login', '/auth/register']
const sessionCookieNames = [
  'next-auth.session-token',
  '__Secure-next-auth.session-token',
]

export function middleware(request: NextRequest) {
  const enforceHttps = (process.env.ENFORCE_HTTPS ?? 'true').toLowerCase() === 'true'
  const host = request.headers.get('host') ?? ''
  const isLocalHost = /(^localhost(:\d+)?$)|(^127\.0\.0\.1(:\d+)?$)/i.test(host)

  if (enforceHttps && !isLocalHost && request.nextUrl.protocol === 'http:') {
    const httpsUrl = request.nextUrl.clone()
    httpsUrl.protocol = 'https:'
    return NextResponse.redirect(httpsUrl, 301)
  }

  const hasSession = sessionCookieNames.some((name) => request.cookies.has(name))
  const { pathname } = request.nextUrl

  const isProtectedRoute = protectedRoutes.some((route) => pathname.startsWith(route))
  if (isProtectedRoute && !hasSession) {
    return NextResponse.redirect(new URL('/auth/login', request.url))
  }

  const isPublicRoute = publicRoutes.some((route) => pathname.startsWith(route))
  if (isPublicRoute && hasSession) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
