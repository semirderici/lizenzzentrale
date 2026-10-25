// Cookie rules for the Supabase session, shared by the server client (server.ts) and the gate
// (src/proxy.ts). @supabase/ssr merges them into every cookie it writes; the lifetime stays as
// Supabase sets it, so the session survives closing the browser (design.md → Sitzung).
import type { CookieOptionsWithName } from '@supabase/ssr'

/**
 * HttpOnly (an injected script cannot read the session), SameSite=Lax, and Secure unless the
 * connection is plain http (local development). `protocol` is a URL protocol (`http:`) or an
 * `X-Forwarded-Proto` value (`http`, `https`, possibly a list); unknown counts as secure.
 */
export function sessionCookieOptions(protocol: string | null | undefined): CookieOptionsWithName {
  const first = (protocol ?? '').split(',')[0].trim().toLowerCase().replace(/:$/, '')
  return { httpOnly: true, sameSite: 'lax', secure: first !== 'http' }
}
