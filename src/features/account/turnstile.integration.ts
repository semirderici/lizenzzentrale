// Server-side Turnstile check (design.md → Bot-Prüfung, Grundsatz 4). A missing secret, no answer
// or an answer that cannot be read is an error, never a pass.
import 'server-only'

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'
const TIMEOUT_MS = 10_000

// Cloudflare reports these when the problem is on our side or on theirs, not with the visitor.
const ERROR_CODES = new Set(['missing-input-secret', 'invalid-input-secret', 'internal-error'])

export type TurnstileVerdict = 'passed' | 'rejected' | 'error'

/**
 * Sends the token to Cloudflare. `remoteIp` goes along only when given; the caller decides
 * (only public addresses, account.rules.ts → clientIpFrom).
 */
export async function verifyTurnstileToken(token: string, remoteIp?: string): Promise<TurnstileVerdict> {
  const secret = process.env.TURNSTILE_SECRET_KEY
  if (!secret) return 'error'

  const body = new URLSearchParams({ secret, response: token })
  if (remoteIp) body.set('remoteip', remoteIp)

  let result: unknown
  try {
    const response = await fetch(SITEVERIFY_URL, {
      method: 'POST',
      body,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (!response.ok) return 'error'
    result = await response.json()
  } catch {
    return 'error'
  }

  if (typeof result !== 'object' || result === null) return 'error'
  const { success, 'error-codes': errorCodes } = result as { success?: unknown; 'error-codes'?: unknown }
  if (typeof success !== 'boolean') return 'error'
  if (success) return 'passed'
  if (Array.isArray(errorCodes) && errorCodes.some((code) => ERROR_CODES.has(code))) return 'error'
  return 'rejected'
}
