'use server'
// The entry point of "Einladung senden" and "Erneut senden" (features/PROJ-3-invitation-email/
// design.md → "Senden und erneut senden — sendInvitation"). The button calls it with the licence
// id as a POST; the server checks everything again, since a request can bypass the button. The
// training provider always comes from the guard and the recipient from the stored licence, never
// from the input (AC-9). The quota plays no role: an invitation is no new licence (EC-12). After
// every answer about the licence the page is refreshed, so the list shows the database's state.
import { refresh } from 'next/cache'
import { requireTrainingProvider } from '@/features/account/session.data'
import { isLicenseVisible } from './invitations.data'
import { deliverInvitation } from './invitations.delivery'
import type { SendInvitationResult } from './invitations.rules'
import { sendInvitationSchema } from './invitations.schema'

/** design.md → Senden. "Einladung senden" and "Erneut senden" are the same action (AC-5, AC-6). */
export async function sendInvitation(input: unknown): Promise<SendInvitationResult> {
  // Signed out: the guard redirects to /login?reason=session. Unassigned: nothing is read or sent (EC-11).
  const admin = await requireTrainingProvider()
  if (admin.status !== 'assigned') return { status: 'unassigned' }

  // Only a manipulated request sends something else.
  const parsed = sendInvitationSchema.safeParse(input)
  if (!parsed.success) return { status: 'error' }

  const { id, name } = admin.trainingProvider
  const visibility = await isLicenseVisible(id, parsed.data.licenseId)
  switch (visibility.status) {
    case 'error':
      return { status: 'error' }
    case 'not_visible':
      // Revoked meanwhile — or foreign, which looks exactly the same (EC-5, AC-9).
      refresh()
      return { status: 'already_revoked' }
    case 'visible':
      break
  }

  // Never throws; every outcome is the answer as it is (AC-5, AC-7, AC-8, EC-1).
  const outcome = await deliverInvitation({ id, name }, parsed.data.licenseId)
  refresh()
  return outcome
}
