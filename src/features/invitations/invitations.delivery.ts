import 'server-only'
// Sending one invitation (design.md → "Versand einer Einladung"): begin, build the mail, hand it
// to Mailjet, finish. The interface assignLicense and sendInvitation call once their own guard
// has run. Deliberately not a 'use server' file: every export there could be called from the
// browser and would trust the training-provider id sent along.
//
// Never throws: every error ends in "failed". An unexpected exception or a missing or invalid
// platform link leaves one fixed line on the server console — never the error, a value, an
// address or a name (PROJ-2 QA, O-1). Mailjet's own failures are logged by mailjet.integration.ts.
import { buildInvitationMail, platformUrlFrom } from './invitation-mail.rules'
import { beginInvitation, finishInvitation } from './invitations.data'
import type { DeliveryOutcome } from './invitations.rules'
import { sendMail } from './mailjet.integration'

/** The training provider from the guard (requireTrainingProvider → admin.trainingProvider). */
type TrainingProvider = { id: string; name: string }

const UNEXPECTED_ERROR = 'Einladung: unerwarteter Fehler beim Versand'
const INVALID_PLATFORM_URL = 'Einladung: Linkziel nicht eingestellt oder ungültig (LEARNING_PLATFORM_URL)'

/** Versandausgang for this licence (AC-1 to AC-3, AC-5, AC-7, AC-8, EC-1 to EC-5, EC-8, EC-9). */
export async function deliverInvitation(
  trainingProvider: TrainingProvider,
  licenseId: string,
): Promise<DeliveryOutcome> {
  let unexpected = false
  try {
    const begun = await beginInvitation(trainingProvider.id, licenseId)
    switch (begun.status) {
      case 'allowed':
        break
      case 'not_found':
      case 'already_sending':
        return { status: begun.status }
      case 'license_limit':
      case 'provider_limit':
        return { status: begun.status, availableFrom: begun.availableFrom }
      default:
        // 'error': nothing was reserved, so there is nothing to finish.
        return { status: 'failed' }
    }

    // From here on the send is reserved, so it is finished exactly once, whatever happens.
    let accepted = false
    try {
      // Read on every call, so the app starts without it (EC-9).
      const platformUrl = platformUrlFrom(process.env.LEARNING_PLATFORM_URL)
      if (platformUrl === null) {
        // The cause without the value, so a typo in the setup shows (design.md → Technische Entscheidungen).
        console.error(INVALID_PLATFORM_URL)
      } else {
        const mail = buildInvitationMail(trainingProvider.name, platformUrl)
        // Exactly the address the database function returned (EC-8).
        const verdict = await sendMail({ to: begun.email, subject: mail.subject, text: mail.text, html: mail.html })
        accepted = verdict === 'accepted'
      }
    } catch {
      unexpected = true
    }

    try {
      // A failed finish leaves the state on 'sending'; it shows as failed after 2 minutes (EC-3).
      await finishInvitation(begun.sendId, accepted)
    } catch {
      unexpected = true
    }

    // Mailjet's verdict decides, whether or not the finish went through.
    return accepted ? { status: 'sent' } : { status: 'failed' }
  } catch {
    unexpected = true
    return { status: 'failed' }
  } finally {
    if (unexpected) console.error(UNEXPECTED_ERROR)
  }
}
