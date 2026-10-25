// Login brake and registration brake: the five database functions from
// supabase/migrations/20261021120100_proj1_login_throttle.sql, called with the admin client
// (only service_role may execute them). A database error or an unexpected answer is an error
// result, never "allowed" (design.md → Login-Bremse im Detail, Registrierungsbremse).
import 'server-only'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'

export type BeginLoginResult =
  | { status: 'allowed'; attemptId: number }
  | { status: 'locked'; lockedUntil: Date }
  | { status: 'error' }

export type BeginRegistrationResult =
  | { status: 'allowed'; attemptId: number }
  | { status: 'locked' }
  | { status: 'error' }

const attemptId = z.number().int().positive()

const beginLoginAnswer = z.discriminatedUnion('status', [
  z.object({ status: z.literal('allowed'), attempt_id: attemptId }),
  z.object({ status: z.literal('locked'), locked_until: z.iso.datetime({ offset: true }) }),
])

const beginRegistrationAnswer = z.discriminatedUnion('status', [
  z.object({ status: z.literal('allowed'), attempt_id: attemptId }),
  z.object({ status: z.literal('locked') }),
])

async function callFunction(fn: string, args: Record<string, unknown>) {
  try {
    const { data, error } = await createAdminClient().rpc(fn, args)
    return error ? { ok: false as const } : { ok: true as const, data: data as unknown }
  } catch {
    return { ok: false as const }
  }
}

/** Address and IP as the app normalised them; the database normalises the address once more. */
export async function beginLogin(email: string, ipAddress: string): Promise<BeginLoginResult> {
  const result = await callFunction('license_center_begin_login', {
    p_email: email,
    p_ip_address: ipAddress,
  })
  if (!result.ok) return { status: 'error' }
  const answer = beginLoginAnswer.safeParse(result.data)
  if (!answer.success) return { status: 'error' }
  return answer.data.status === 'allowed'
    ? { status: 'allowed', attemptId: answer.data.attempt_id }
    : { status: 'locked', lockedUntil: new Date(answer.data.locked_until) }
}

/** true when the attempt was closed; false on any error (the attempt then stays pending). */
export async function finishLogin(
  attemptId: number,
  outcome: 'success' | 'failure' | 'error'
): Promise<boolean> {
  const result = await callFunction('license_center_finish_login', {
    p_attempt_id: attemptId,
    p_outcome: outcome,
  })
  return result.ok
}

export async function beginRegistration(ipAddress: string): Promise<BeginRegistrationResult> {
  const result = await callFunction('license_center_begin_registration', { p_ip_address: ipAddress })
  if (!result.ok) return { status: 'error' }
  const answer = beginRegistrationAnswer.safeParse(result.data)
  if (!answer.success) return { status: 'error' }
  return answer.data.status === 'allowed'
    ? { status: 'allowed', attemptId: answer.data.attempt_id }
    : { status: 'locked' }
}

/** true when the attempt was closed; false on any error. */
export async function finishRegistration(
  attemptId: number,
  outcome: 'success' | 'duplicate' | 'error'
): Promise<boolean> {
  const result = await callFunction('license_center_finish_registration', {
    p_attempt_id: attemptId,
    p_outcome: outcome,
  })
  return result.ok
}

/** Yes/no for the unclear error case of a registration (EC-2); null when the question failed. */
export async function isEmailRegistered(email: string): Promise<boolean | null> {
  const result = await callFunction('license_center_email_registered', { p_email: email })
  return result.ok && typeof result.data === 'boolean' ? result.data : null
}
