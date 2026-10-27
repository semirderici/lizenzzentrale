// The input of "Senden" / "Erneut senden": only the licence. The training provider always comes
// from the guard and the recipient always from the stored licence, so keys sent along (an
// address, a training provider) are stripped (AC-9).
// See features/PROJ-3-invitation-email/design.md → "Eingaberegeln".
import { z } from 'zod'

/** Only a manipulated request sends anything else; the action answers it with "Fehler". */
export const sendInvitationSchema = z.object({ licenseId: z.uuid() })

export type SendInvitationInput = z.input<typeof sendInvitationSchema>
export type SendInvitationValues = z.output<typeof sendInvitationSchema>
