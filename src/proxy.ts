// The gate (design.md → Tor): refreshes the Supabase session on every request, asks the Auth
// server whether it is still valid, and redirects GET/HEAD before any page renders (AC-9, EC-6).
// POST and every other method pass through: Server Actions and /sign-out check for themselves.
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { sessionCookieOptions } from '@/lib/supabase/cookie-options'

const SIGNED_IN_HOME = '/licenses'
const LOGIN = '/login'
const AUTH_PAGES = new Set([LOGIN, '/register'])

type SessionCookie = { name: string; value: string; options: CookieOptions }

export async function proxy(request: NextRequest) {
  // Everything setAll wrote, kept so that a redirect carries it as well as the pass-through.
  const cookieJar = new Map<string, SessionCookie>()
  const sessionHeaders: Record<string, string> = {}
  const withSession = (response: NextResponse) => {
    cookieJar.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
    Object.entries(sessionHeaders).forEach(([key, value]) => response.headers.set(key, value))
    return response
  }

  let response = NextResponse.next({ request })
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: sessionCookieOptions(request.nextUrl.protocol),
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach((cookie) => {
            request.cookies.set(cookie.name, cookie.value)
            cookieJar.set(cookie.name, cookie)
          })
          Object.assign(sessionHeaders, headers)
          // A fresh pass-through forwards the refreshed request cookies to the page.
          response = withSession(NextResponse.next({ request }))
        },
      },
    }
  )

  // getUser asks the Auth server, so a session ended elsewhere counts at once (not getClaims).
  let signedIn = false
  try {
    const { data, error } = await supabase.auth.getUser()
    signedIn = !error && Boolean(data.user)
  } catch {
    // Unreachable Auth server or similar: treat as signed out, never as signed in.
  }

  if (request.method !== 'GET' && request.method !== 'HEAD') return response

  // Only fixed targets; the original query string is never carried over.
  const redirectTo = (pathname: string, reason?: 'session') => {
    const url = new URL(pathname, request.url)
    if (reason) url.searchParams.set('reason', reason)
    return withSession(NextResponse.redirect(url))
  }

  const { pathname } = request.nextUrl
  if (pathname === '/') return redirectTo(signedIn ? SIGNED_IN_HOME : LOGIN)
  if (AUTH_PAGES.has(pathname)) return signedIn ? redirectTo(SIGNED_IN_HOME) : response
  if (!signedIn) return redirectTo(LOGIN, 'session')
  return response
}

export const config = {
  // Everything except Next.js build output, image optimisation, the favicon and image files.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
}
