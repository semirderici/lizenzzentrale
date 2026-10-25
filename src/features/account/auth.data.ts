// Registering, the password check and signing out (design.md → Registrieren, Anmelden, Abmelden).
// Registering and the password check go through the admin client: Supabase exempts it from its
// CAPTCHA, which runs with a secret that always fails, so the only way in is this app's own bot
// check and brakes. The session Supabase hands back is written into the user's cookies.
import 'server-only'
import type { AuthError, Session } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export type SignUpResult =
  | { status: 'success' }
  | { status: 'duplicate' }
  | { status: 'auth_rate_limited' }
  | { status: 'password_rejected' }
  | { status: 'failed' }

export type SignInResult =
  | { status: 'success' }
  | { status: 'invalid_credentials' }
  | { status: 'auth_rate_limited' }
  | { status: 'failed' }

const DUPLICATE_CODES = new Set(['user_already_exists', 'email_exists'])
const RATE_LIMIT_CODES = new Set(['over_request_rate_limit', 'over_email_send_rate_limit'])

function isRateLimited(error: AuthError) {
  return error.status === 429 || RATE_LIMIT_CODES.has(error.code ?? '')
}

async function storeSession(session: Session) {
  const supabase = await createClient()
  const { error } = await supabase.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  })
  return !error
}

/**
 * Creates the account; the database trigger adds training provider and membership in the same
 * transaction. Expects the address normalised, the password unchanged and the name trimmed
 * (account.schema.ts). Any other error than the known ones is `failed` — the caller then asks
 * the database whether the address exists after all (EC-2).
 */
export async function signUpTrainingProvider(input: {
  email: string
  password: string
  trainingProviderName: string
}): Promise<SignUpResult> {
  try {
    const { data, error } = await createAdminClient().auth.signUp({
      email: input.email,
      password: input.password,
      options: { data: { training_provider_name: input.trainingProviderName } },
    })
    if (error) {
      if (DUPLICATE_CODES.has(error.code ?? '')) return { status: 'duplicate' }
      if (isRateLimited(error)) return { status: 'auth_rate_limited' }
      if (error.code === 'weak_password') return { status: 'password_rejected' }
      return { status: 'failed' }
    }
    // Without a session "Confirm email" is on, which this app does not use (tasks.md T16).
    if (!data.session || !(await storeSession(data.session))) return { status: 'failed' }
    return { status: 'success' }
  } catch {
    return { status: 'failed' }
  }
}

/** Supabase does not tell an unknown address from a wrong password; neither does this (AC-5). */
export async function signInWithPassword(email: string, password: string): Promise<SignInResult> {
  try {
    const { data, error } = await createAdminClient().auth.signInWithPassword({ email, password })
    if (error) {
      if (error.code === 'invalid_credentials') return { status: 'invalid_credentials' }
      if (isRateLimited(error)) return { status: 'auth_rate_limited' }
      return { status: 'failed' }
    }
    return (await storeSession(data.session)) ? { status: 'success' } : { status: 'failed' }
  } catch {
    return { status: 'failed' }
  }
}

/**
 * Ends this browser's session only (scope `local`) and removes its cookies. `hadSession` tells
 * whether the Auth server still knew the session (EC-6: signed out in another tab already).
 */
export async function signOutCurrentSession(): Promise<{ hadSession: boolean }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const { error } = await supabase.auth.signOut({ scope: 'local' })
  if (error) {
    // Supabase unreachable: the browser is signed out all the same.
    const cookieStore = await cookies()
    for (const { name } of cookieStore.getAll()) {
      if (name.startsWith('sb-') && name.includes('-auth-token')) cookieStore.delete(name)
    }
  }
  return { hadSession: user !== null }
}
