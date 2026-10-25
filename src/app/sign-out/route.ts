// Signing out (design.md → Abmelden): POST only, so a link, a prefetch or a foreign image cannot
// sign anyone out; SameSite=Lax keeps the cookies off a POST from another site anyway. The
// header's form submits natively, so the browser loads /login completely afresh (AC-10).
import { NextResponse, type NextRequest } from 'next/server'
import { signOutCurrentSession } from '@/features/account/auth.data'

export async function POST(request: NextRequest) {
  const { hadSession } = await signOutCurrentSession()
  // Without a session (signed out in another tab already) the login shows the notice (EC-6).
  const target = hadSession ? '/login' : '/login?reason=session'
  return NextResponse.redirect(new URL(target, request.url), 303)
}

function methodNotAllowed() {
  return new NextResponse(null, { status: 405, headers: { Allow: 'POST' } })
}

// HEAD falls back to GET. Exported explicitly, so OPTIONS answers 405 as well instead of
// Next.js' automatic 204.
export const GET = methodNotAllowed
export const PUT = methodNotAllowed
export const PATCH = methodNotAllowed
export const DELETE = methodNotAllowed
export const OPTIONS = methodNotAllowed
