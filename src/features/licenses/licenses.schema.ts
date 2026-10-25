// One schema per action, used by the browser (react-hook-form + zodResolver) and by the Server
// Actions alike, so requests that bypass the dialog meet the same rules (AC-5).
// See features/PROJ-2-license-management/design.md → "Eingaberegeln".
//
// The email field reports at most ONE issue — the message to show. No schema has a field for a
// training provider: it always comes from the guard, and keys sent along are stripped.
import { z } from 'zod'
import { LICENSE_MESSAGES } from './licenses.rules'

/** Longer input is invalid without any further check (as in PROJ-1). */
const MAX_TEXT_LENGTH = 1000
const EMAIL_MAX_LENGTH = 254

/** The same format rule as the account's email in PROJ-1. */
const emailFormat = z.email()

/** Unicode code points, like Postgres `char_length`. */
function codePointLength(value: string): number {
  return Array.from(value).length
}

function emailIssue(value: string): string | undefined {
  if (value.length > MAX_TEXT_LENGTH && codePointLength(value) > MAX_TEXT_LENGTH) {
    return LICENSE_MESSAGES.emailInvalid
  }
  const address = value.trim().toLowerCase()
  if (address === '') return LICENSE_MESSAGES.emailRequired
  if (address.length > EMAIL_MAX_LENGTH || !emailFormat.safeParse(address).success) {
    return LICENSE_MESSAGES.emailInvalid
  }
  return undefined
}

/** Trimmed and lower-cased, the form in which the database stores it (AC-6). */
const email = z
  .string({ error: LICENSE_MESSAGES.emailRequired })
  .check((ctx) => {
    const message = emailIssue(ctx.value)
    if (message !== undefined) ctx.issues.push({ code: 'custom', message, input: ctx.value })
  })
  .trim()
  .toLowerCase()

export const assignLicenseSchema = z.object({ email })

/** Only a manipulated request sends anything else; the action answers it with "Fehler". */
export const revokeLicenseSchema = z.object({ licenseId: z.uuid() })

export type AssignLicenseInput = z.input<typeof assignLicenseSchema>
export type AssignLicenseValues = z.output<typeof assignLicenseSchema>
export type RevokeLicenseInput = z.input<typeof revokeLicenseSchema>
export type RevokeLicenseValues = z.output<typeof revokeLicenseSchema>
