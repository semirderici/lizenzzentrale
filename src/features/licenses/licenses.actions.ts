'use server'
// The two entry points of the licence feature (design.md → Zuweisen, Entziehen). The dialogs
// call them with their values as a POST; the server checks everything again, since a request can
// bypass the dialog (AC-5). The training provider always comes from the guard, never from the
// input (AC-10). After every answer from the database the page is refreshed, so numbers and list
// come from the database, not from a calculation in the browser (AC-1, EC-1, EC-10).
import { refresh } from 'next/cache'
import { requireTrainingProvider } from '@/features/account/session.data'
import { deleteLicense, insertLicense } from './licenses.data'
import { LICENSE_MESSAGES, type AssignResult, type RevokeResult } from './licenses.rules'
import { assignLicenseSchema, revokeLicenseSchema } from './licenses.schema'

/** design.md → Zuweisen. No own quota check: the database decides, so there is no gap. */
export async function assignLicense(input: unknown): Promise<AssignResult> {
  // Signed out: the guard redirects to /login?reason=session (EC-7).
  const admin = await requireTrainingProvider()
  if (admin.status !== 'assigned') return { status: 'unassigned' }

  const parsed = assignLicenseSchema.safeParse(input)
  if (!parsed.success) {
    const emailIssue = parsed.error.issues.find((issue) => issue.path[0] === 'email')
    return emailIssue ? { status: 'field_error', message: emailIssue.message } : { status: 'failed' }
  }

  const result = await insertLicense(admin.trainingProvider.id, parsed.data.email)
  switch (result.status) {
    case 'created':
      // PROJ-3 starts the invitation here, with result.id.
      refresh()
      return { status: 'assigned' }
    case 'already_assigned':
      refresh()
      return { status: 'field_error', message: LICENSE_MESSAGES.alreadyAssigned }
    case 'exhausted':
      refresh()
      return { status: 'exhausted' }
    case 'failed':
      return { status: 'failed' }
  }
}

/** design.md → Entziehen. A foreign licence id looks exactly like one already revoked (EC-3). */
export async function revokeLicense(input: unknown): Promise<RevokeResult> {
  const admin = await requireTrainingProvider()
  if (admin.status !== 'assigned') return { status: 'unassigned' }

  // Only a manipulated request sends something else.
  const parsed = revokeLicenseSchema.safeParse(input)
  if (!parsed.success) return { status: 'failed' }

  const result = await deleteLicense(admin.trainingProvider.id, parsed.data.licenseId)
  switch (result.status) {
    case 'revoked':
      refresh()
      return { status: 'revoked' }
    case 'not_found':
      refresh()
      return { status: 'already_revoked' }
    case 'failed':
      return { status: 'failed' }
  }
}
