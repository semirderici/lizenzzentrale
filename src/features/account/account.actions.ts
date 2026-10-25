'use server'
// The two entry points of the account feature (design.md → Registrieren, Anmelden). Both are
// called by the forms with their values as a POST; the server checks everything again, since a
// request can bypass the form (AC-2, AC-7). On success both redirect to /licenses.
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import type { z } from 'zod'
import {
  clientIpFrom,
  loginFormError,
  MESSAGES,
  registerFormError,
  type FormError,
} from './account.rules'
import {
  exceedsPasswordLimit,
  loginSchema,
  registerSchema,
  type LoginField,
  type RegisterField,
} from './account.schema'
import { signInWithPassword, signUpTrainingProvider } from './auth.data'
import {
  beginLogin,
  beginRegistration,
  finishLogin,
  finishRegistration,
  isEmailRegistered,
} from './throttle.data'
import { verifyTurnstileToken } from './turnstile.integration'

export type RegisterState = {
  fieldErrors?: Partial<Record<RegisterField, string>>
  formError?: FormError
}

export type LoginState = {
  fieldErrors?: Partial<Record<LoginField, string>>
  formError?: FormError
}

/** Every login answer except success comes this long after the request at the earliest (AC-5). */
const LOGIN_MIN_RESPONSE_MS = 1_000

/**
 * Field issues become field messages; the token's issue is the form message of a failed bot
 * check; anything that is not a field (input that is not an object at all) the general one.
 */
function inputErrors<Field extends string>(
  error: z.ZodError,
  fields: readonly Field[],
  general: string
): { fieldErrors?: Partial<Record<Field, string>>; formError?: FormError } {
  const fieldErrors: Partial<Record<Field, string>> = {}
  let formError: FormError | undefined
  for (const issue of error.issues) {
    const field = issue.path[0] as Field
    if (field === 'turnstileToken') formError = { message: MESSAGES.botCheckFailed }
    else if (fields.includes(field)) fieldErrors[field] ??= issue.message
    else formError ??= { message: general }
  }
  return {
    ...(Object.keys(fieldErrors).length > 0 ? { fieldErrors } : {}),
    ...(formError ? { formError } : {}),
  }
}

/**
 * X-Forwarded-For counts only behind a proxy that writes it itself (TRUSTED_PROXY=true, set at
 * go-live). Without one the client sets it and could pick a fresh address per attempt (BUG-2),
 * so every request counts under the same stand-in address and the IP brake acts as one brake.
 */
async function visitorIp() {
  const trustedProxy = process.env.TRUSTED_PROXY === 'true'
  return clientIpFrom(trustedProxy ? (await headers()).get('x-forwarded-for') : null)
}

export async function register(input: unknown): Promise<RegisterState> {
  const parsed = registerSchema.safeParse(input)
  if (!parsed.success) {
    return inputErrors(
      parsed.error,
      ['trainingProviderName', 'email', 'password', 'passwordConfirmation'] as const,
      MESSAGES.registrationFailed
    )
  }
  const { trainingProviderName, email, password, turnstileToken } = parsed.data
  const ip = await visitorIp()

  const verdict = await verifyTurnstileToken(turnstileToken, ip.isPublic ? ip.ip : undefined)
  if (verdict === 'rejected') return { formError: registerFormError('bot_check_rejected') }
  if (verdict === 'error') return { formError: registerFormError('bot_check_error') }

  const brake = await beginRegistration(ip.ip)
  if (brake.status === 'locked') return { formError: registerFormError('throttled') }
  if (brake.status === 'error') return { formError: registerFormError('failed') }

  const result = await signUpTrainingProvider({ email, password, trainingProviderName })
  switch (result.status) {
    case 'success':
      await finishRegistration(brake.attemptId, 'success')
      return redirect('/licenses')
    case 'duplicate':
      await finishRegistration(brake.attemptId, 'duplicate')
      return { formError: registerFormError('duplicate') }
    case 'auth_rate_limited':
      await finishRegistration(brake.attemptId, 'error')
      return { formError: registerFormError('auth_rate_limited') }
    case 'password_rejected':
      // Only a safety net: the schema allows no password Supabase would refuse.
      await finishRegistration(brake.attemptId, 'error')
      return { fieldErrors: { password: MESSAGES.passwordTooShort } }
    case 'failed': {
      // The loser of two simultaneous registrations gets a generic error from Supabase (EC-2).
      const registered = await isEmailRegistered(email)
      await finishRegistration(brake.attemptId, registered ? 'duplicate' : 'error')
      return { formError: registerFormError(registered ? 'duplicate' : 'failed') }
    }
  }
}

export async function login(input: unknown): Promise<LoginState> {
  const receivedAt = Date.now()
  const answer = async (state: LoginState) => {
    // Unknown and known addresses must not differ in response time (AC-5).
    const wait = receivedAt + LOGIN_MIN_RESPONSE_MS - Date.now()
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait))
    return state
  }

  const parsed = loginSchema.safeParse(input)
  if (!parsed.success) {
    const errors = inputErrors(parsed.error, ['email', 'password'] as const, MESSAGES.loginFailed)
    const { password } = (typeof input === 'object' && input !== null ? input : {}) as { password?: unknown }
    // A password that can never be right gets the AC-5 answer, without bot check or counting.
    if (!errors.fieldErrors && typeof password === 'string' && exceedsPasswordLimit(password)) {
      return answer({ formError: loginFormError('invalid_credentials') })
    }
    return answer(errors)
  }
  const { email, password, turnstileToken } = parsed.data
  if (exceedsPasswordLimit(password)) return answer({ formError: loginFormError('invalid_credentials') })

  const ip = await visitorIp()
  const verdict = await verifyTurnstileToken(turnstileToken, ip.isPublic ? ip.ip : undefined)
  if (verdict === 'rejected') return answer({ formError: loginFormError('bot_check_rejected') })
  if (verdict === 'error') return answer({ formError: loginFormError('bot_check_error') })

  const brake = await beginLogin(email, ip.ip)
  if (brake.status === 'locked') {
    return answer({ formError: loginFormError('locked', { lockedUntil: brake.lockedUntil, now: new Date() }) })
  }
  if (brake.status === 'error') return answer({ formError: loginFormError('failed') })

  const result = await signInWithPassword(email, password)
  switch (result.status) {
    case 'success':
      // EC-7: a success starts the count of this address again.
      await finishLogin(brake.attemptId, 'success')
      return redirect('/licenses')
    case 'invalid_credentials':
      await finishLogin(brake.attemptId, 'failure')
      return answer({ formError: loginFormError('invalid_credentials') })
    case 'auth_rate_limited':
      await finishLogin(brake.attemptId, 'error')
      return answer({ formError: loginFormError('auth_rate_limited') })
    case 'failed':
      await finishLogin(brake.attemptId, 'error')
      return answer({ formError: loginFormError('failed') })
  }
}
