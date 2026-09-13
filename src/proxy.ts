import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Renamed from `middleware` - Next 16 deprecated that convention.
 *
 * This is a cheap gate only: it checks that a session cookie is present so
 * signed-out visitors bounce to /login instead of flashing the app shell. It
 * deliberately does NOT verify the token or read the database, because proxy
 * runs outside the render path. Real verification (and every role check)
 * happens in requireUser/requireAdmin and the API handlers.
 */
const PUBLIC_PATHS = ['/login']

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const hasSession = request.cookies.has('tensors_session')

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    if (hasSession) return NextResponse.redirect(new URL('/', request.url))
    return NextResponse.next()
  }

  if (!hasSession) {
    const url = new URL('/login', request.url)
    if (pathname !== '/') url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  // Exclude static assets, or the redirect swallows CSS and images too.
  matcher: ['/((?!api/auth|_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|ico)$).*)'],
}
