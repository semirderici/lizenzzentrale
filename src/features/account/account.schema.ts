// One schema per form, used by the browser (react-hook-form + zodResolver) and by the server
// actions alike, so requests that bypass the form meet the same rules (AC-2).
// See features/PROJ-1-account-login/design.md → "Eingaberegeln".
//
// Every field reports at most ONE issue — the most relevant message — so a form can show it
// as is. "Characters" are Unicode code points, counted like Postgres `char_length`.
import { z } from 'zod'
import { MESSAGES } from './account.rules'

/** Every user text field is cut off here before any other rule runs. */
export const MAX_TEXT_LENGTH = 1000
/** Cloudflare's maximum Turnstile token length. */
export const MAX_TURNSTILE_TOKEN_LENGTH = 2048

const NAME_MIN_LENGTH = 2
const NAME_MAX_LENGTH = 100
const EMAIL_MAX_LENGTH = 254
const PASSWORD_MIN_LENGTH = 8
/** Supabase accepts at most 72 bytes; the same number caps the characters. */
const PASSWORD_MAX_LENGTH = 72
const PASSWORD_MAX_BYTES = 72

/** Unicode code points, like Postgres `char_length` (an emoji is 1, not 2 as in `.length`). */
function codePointLength(value: string): number {
  return Array.from(value).length
}

function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).length
}

/** true if the password is longer than 72 characters (code points) or 72 UTF-8 bytes. Used by the login action for AC-5. */
export function exceedsPasswordLimit(password: string): boolean {
  // Code points ≤ UTF-16 units ≤ UTF-8 bytes, so the byte limit also covers the 72 characters.
  // Comparing the units first keeps a huge input from being encoded at all.
  return password.length > PASSWORD_MAX_BYTES || utf8ByteLength(password) > PASSWORD_MAX_BYTES
}

/** A field's rule: the one message to show, or undefined when the value is fine. */
type FieldRule = (value: string) => string | undefined

/** A string field that reports at most one issue: `missing` for a non-string, else `rule`'s message. */
function stringField(missing: string, rule: FieldRule) {
  return z.string({ error: missing }).check((ctx) => {
    const message = rule(ctx.value)
    if (message !== undefined) ctx.issues.push({ code: 'custom', message, input: ctx.value })
  })
}

/** A user text field: first the 1,000-character cut-off (→ `tooLong`), then `rule` on the raw value. */
function textField(missing: string, tooLong: string, rule: FieldRule) {
  return stringField(missing, (value) =>
    value.length > MAX_TEXT_LENGTH && codePointLength(value) > MAX_TEXT_LENGTH
      ? tooLong
      : rule(value),
  )
}

const trainingProviderName = textField(MESSAGES.nameRequired, MESSAGES.nameTooLong, (value) => {
  const name = value.trim()
  if (name === '') return MESSAGES.nameRequired
  const length = codePointLength(name)
  if (length < NAME_MIN_LENGTH) return MESSAGES.nameTooShort
  if (length > NAME_MAX_LENGTH) return MESSAGES.nameTooLong
  return undefined
}).trim()

const emailFormat = z.email()

/** Trimmed and lower-cased, in both forms and before counting failed logins (EC-4). */
const email = textField(MESSAGES.emailRequired, MESSAGES.emailInvalid, (value) => {
  const address = value.trim().toLowerCase()
  if (address === '') return MESSAGES.emailRequired
  if (address.length > EMAIL_MAX_LENGTH || !emailFormat.safeParse(address).success) {
    return MESSAGES.emailInvalid
  }
  return undefined
})
  .trim()
  .toLowerCase()

/** Never trimmed or changed (EC-4). No rules on kinds of characters. */
const newPassword = textField(MESSAGES.passwordTooShort, MESSAGES.passwordTooLong, (password) => {
  const length = codePointLength(password)
  if (length < PASSWORD_MIN_LENGTH) return MESSAGES.passwordTooShort
  if (length > PASSWORD_MAX_LENGTH) return MESSAGES.passwordTooLong
  if (utf8ByteLength(password) > PASSWORD_MAX_BYTES) return MESSAGES.passwordTooManyBytes
  return undefined
})

const passwordConfirmation = textField(
  MESSAGES.passwordConfirmationRequired,
  MESSAGES.passwordTooLong,
  (value) => (value === '' ? MESSAGES.passwordConfirmationRequired : undefined),
)

/**
 * Only required. A login password over 72 characters or bytes gets no field error: the login
 * action answers it with the AC-5 message via `exceedsPasswordLimit` (design.md → "Anmelden").
 */
const loginPassword = stringField(MESSAGES.loginPasswordRequired, (password) =>
  password === '' ? MESSAGES.loginPasswordRequired : undefined,
)

/** Missing, empty or too long all read as a failed bot check (AC-7). */
const turnstileToken = stringField(MESSAGES.botCheckFailed, (token) =>
  token === '' || token.length > MAX_TURNSTILE_TOKEN_LENGTH ? MESSAGES.botCheckFailed : undefined,
)

export const registerSchema = z
  .object({
    trainingProviderName,
    email,
    password: newPassword,
    passwordConfirmation,
    turnstileToken,
  })
  .refine((values) => values.password === values.passwordConfirmation, {
    error: MESSAGES.passwordMismatch,
    path: ['passwordConfirmation'],
    // Runs even when other fields have issues, so every affected field shows its message at
    // once (AC-2) — but only on two strings, and never on top of the confirmation's own issue.
    when: ({ value, issues }) => {
      if (typeof value !== 'object' || value === null) return false
      const { password, passwordConfirmation } = value as Record<string, unknown>
      return (
        typeof password === 'string' &&
        typeof passwordConfirmation === 'string' &&
        !issues.some((issue) => issue.path?.[0] === 'passwordConfirmation')
      )
    },
  })

export const loginSchema = z.object({
  email,
  password: loginPassword,
  turnstileToken,
})

export type RegisterInput = z.input<typeof registerSchema>
export type RegisterValues = z.output<typeof registerSchema>
export type LoginInput = z.input<typeof loginSchema>
export type LoginValues = z.output<typeof loginSchema>
export type RegisterField = keyof RegisterInput
export type LoginField = keyof LoginInput
