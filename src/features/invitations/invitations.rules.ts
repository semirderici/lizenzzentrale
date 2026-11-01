// Pure rules of the invitation feature: every text a user reads (except the mail itself), the
// state of an invitation in the list, the time from which a limit lets the next one through,
// and the mapping of a send or assign result to its toast. No IO, no framework, no clock — time
// is always passed in.
// See features/PROJ-3-invitation-email/design.md → "Versandstand in der Liste",
// "Darstellung der Ergebnisse", "Meldungstexte".
//
// Never imports src/features/licenses/: licenses imports from here, the other way round would be
// a cycle. The two texts PROJ-2 owns are kept as own constants; a test holds them equal.
import { MESSAGES } from '@/features/account/account.rules'

export const INVITATION_MESSAGES = {
  // List (AC-4, AC-6, EC-3)
  columnInvitation: 'Einladung',
  cardLabel: 'Einladung:',
  stateNotInvited: 'Noch nicht eingeladen',
  stateSending: 'Wird versendet',
  stateSentOn: 'Versendet am',
  stateFailed: 'Fehlgeschlagen',
  send: 'Einladung senden',
  resend: 'Erneut senden',
  // Note in the "Lizenz zugewiesen" toast (AC-1, AC-3, EC-9)
  assignSent: 'Die Einladung ist versendet.',
  assignFailed:
    'Die Einladung konnte nicht versendet werden. Sie können sie in der Liste erneut senden.',
  // Results of "Senden" (AC-5, EC-1, EC-5, EC-9 to EC-11)
  sent: 'Einladung versendet',
  sendFailed:
    'Die Einladung konnte nicht versendet werden. Bitte versuchen Sie es später erneut.',
  alreadySending: 'Die Einladung wird gerade versendet.',
  // Same text as PROJ-2 (LICENSE_MESSAGES.alreadyRevoked and .failed)
  alreadyRevoked: 'Diese Lizenz wurde bereits entzogen.',
  failed: 'Das hat nicht geklappt. Bitte versuchen Sie es erneut.',
  noConnection: MESSAGES.noConnection,
  unassigned: MESSAGES.unassigned,
} as const

export type InvitationStatus = 'sending' | 'sent' | 'failed'

/** Versandstand: the license_invitations row, or null = never invited. lastAttemptAt is an ISO string. */
export type InvitationState = { status: InvitationStatus; lastAttemptAt: string } | null

/** Versandausgang of deliverInvitation. availableFrom is an ISO string. */
export type DeliveryOutcome =
  | { status: 'sent' }
  | { status: 'failed' }
  | { status: 'not_found' }
  | { status: 'already_sending' }
  | { status: 'license_limit'; availableFrom: string }
  | { status: 'provider_limit'; availableFrom: string }

/** Ergebnis of the Server Action sendInvitation. */
export type SendInvitationResult =
  | DeliveryOutcome
  | { status: 'already_revoked' }
  | { status: 'unassigned' }
  | { status: 'error' }

/** Anzeigezustand in the list (design.md → "Versandstand in der Liste"). label is the full visible text. */
export type InvitationDisplay =
  | { state: 'not_invited'; label: string; action: 'send' }
  | { state: 'sending'; label: string; action: null }
  | { state: 'sent'; label: string; sentAt: string; date: string; action: 'resend' }
  | { state: 'failed'; label: string; action: 'resend' }

/** A send still 'sending' after this long has hung; it shows (and counts) as failed (EC-3). */
const STALE_SENDING_MS = 2 * 60_000

/**
 * Exactly one of four states with the action beside it (AC-4, AC-6, EC-3). `now` is the server's
 * time at render. An unreadable lastAttemptAt never leaves 'sending' stuck: it shows as failed,
 * so the button to resend is there.
 */
export function invitationDisplay(invitation: InvitationState, now: Date): InvitationDisplay {
  if (invitation === null) {
    return { state: 'not_invited', label: INVITATION_MESSAGES.stateNotInvited, action: 'send' }
  }
  switch (invitation.status) {
    case 'sending': {
      const age = now.getTime() - new Date(invitation.lastAttemptAt).getTime()
      if (age < STALE_SENDING_MS) {
        return { state: 'sending', label: INVITATION_MESSAGES.stateSending, action: null }
      }
      return { state: 'failed', label: INVITATION_MESSAGES.stateFailed, action: 'resend' }
    }
    case 'sent': {
      const date = formatSentDate(invitation.lastAttemptAt)
      return {
        state: 'sent',
        label: `${INVITATION_MESSAGES.stateSentOn} ${date}`,
        sentAt: invitation.lastAttemptAt,
        date,
        action: 'resend',
      }
    }
    case 'failed':
      return { state: 'failed', label: INVITATION_MESSAGES.stateFailed, action: 'resend' }
  }
}

// The server may run in UTC; without a fixed zone a mail sent at 0:30 would show the day before.
const sentDateFormat = new Intl.DateTimeFormat('de-DE', {
  timeZone: 'Europe/Berlin',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

/** 'TT.MM.JJJJ' in Europe/Berlin (AC-1, AC-4). */
export function formatSentDate(value: string | Date): string {
  return sentDateFormat.format(new Date(value))
}

// h23, so midnight is '00' and never '24'. Assembled from the parts, so the separators do not
// depend on the runtime's locale data.
const availableFromFormat = new Intl.DateTimeFormat('de-DE', {
  timeZone: 'Europe/Berlin',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

const MINUTE_MS = 60_000

/**
 * 'TT.MM.JJJJ, HH:MM Uhr' in Europe/Berlin, rounded UP to the next full minute, so the named time
 * is never too early (design.md → "Meldungstexte"). An exact full minute stays.
 */
export function formatAvailableFrom(value: string | Date): string {
  const roundedUp = new Date(Math.ceil(new Date(value).getTime() / MINUTE_MS) * MINUTE_MS)
  const parts: Partial<Record<Intl.DateTimeFormatPartTypes, string>> = {}
  for (const { type, value: part } of availableFromFormat.formatToParts(roundedUp)) {
    parts[type] = part
  }
  return `${parts.day}.${parts.month}.${parts.year}, ${parts.hour}:${parts.minute} Uhr`
}

/** The limit per licence: 3 accepted sends in 24 hours (AC-7). */
export function licenseLimitMessage(availableFrom: string | Date): string {
  return `Diese Einladung wurde in den letzten 24 Stunden bereits dreimal versendet. Sie können sie ab ${formatAvailableFrom(availableFrom)} erneut senden.`
}

/** The limit per training provider: 30 accepted sends in 24 hours (AC-8, EC-2). */
export function providerLimitMessage(availableFrom: string | Date): string {
  return `Die Einladung wurde nicht versendet, weil Ihr Bildungsträger in den letzten 24 Stunden bereits 30 Einladungen versendet hat. Sie können sie ab ${formatAvailableFrom(availableFrom)} senden.`
}

/** The visible text of the button (AC-4, AC-6). */
export function sendButtonLabel(action: 'send' | 'resend'): string {
  return action === 'send' ? INVITATION_MESSAGES.send : INVITATION_MESSAGES.resend
}

/** The screen-reader name of the button, with the address (design.md → Knopf). */
export function sendButtonAccessibleLabel(action: 'send' | 'resend', email: string): string {
  return action === 'send' ? `Einladung an ${email} senden` : `Einladung an ${email} erneut senden`
}

/** The toast after "Senden" / "Erneut senden": success or error (design.md → "Darstellung der Ergebnisse"). */
export type SendFeedback = { kind: 'success' | 'error'; message: string }

export function sendFeedback(result: SendInvitationResult): SendFeedback {
  switch (result.status) {
    case 'sent':
      return { kind: 'success', message: INVITATION_MESSAGES.sent }
    case 'failed':
      return { kind: 'error', message: INVITATION_MESSAGES.sendFailed }
    case 'already_sending':
      return { kind: 'error', message: INVITATION_MESSAGES.alreadySending }
    case 'license_limit':
      return { kind: 'error', message: licenseLimitMessage(result.availableFrom) }
    case 'provider_limit':
      return { kind: 'error', message: providerLimitMessage(result.availableFrom) }
    // not_found: the licence vanished between the visibility check and the database function.
    case 'not_found':
    case 'already_revoked':
      return { kind: 'error', message: INVITATION_MESSAGES.alreadyRevoked }
    case 'unassigned':
      return { kind: 'error', message: INVITATION_MESSAGES.unassigned }
    case 'error':
      return { kind: 'error', message: INVITATION_MESSAGES.failed }
  }
}

/**
 * A call that threw instead of answering (EC-10): no answer at all (fetch fails with a TypeError)
 * is "Keine Verbindung", anything else "Das hat nicht geklappt". The redirect after `redirect()`
 * is not an error; the button recognises it before calling this.
 */
export function sendThrownFeedback(error: unknown): SendFeedback {
  return {
    kind: 'error',
    message: error instanceof TypeError ? INVITATION_MESSAGES.noConnection : INVITATION_MESSAGES.failed,
  }
}

/** The note under "Lizenz zugewiesen" and whether that toast is a success or a warning. */
export type AssignInvitationNote = { kind: 'success' | 'warning'; description: string }

/**
 * The licence is assigned in every case; only the invitation may not have gone out (AC-1, AC-3,
 * AC-8, EC-9). Outcomes a new licence cannot have count as failed (design.md → "Zuweisen").
 */
export function assignInvitationNote(outcome: DeliveryOutcome): AssignInvitationNote {
  switch (outcome.status) {
    case 'sent':
      return { kind: 'success', description: INVITATION_MESSAGES.assignSent }
    case 'provider_limit':
      return { kind: 'warning', description: providerLimitMessage(outcome.availableFrom) }
    case 'failed':
    case 'not_found':
    case 'already_sending':
    case 'license_limit':
      return { kind: 'warning', description: INVITATION_MESSAGES.assignFailed }
  }
}
