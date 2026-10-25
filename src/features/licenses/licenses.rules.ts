// Pure rules of the licence feature: every text a user reads, the state of the quota, the date
// of an assignment, and the mapping of an action's result to what the dialog shows. No IO, no
// framework, no clock.
// See features/PROJ-2-license-management/design.md → "Regeln für Anzeige und Liste",
// "Darstellung der Ergebnisse", "Meldungstexte".
import { MESSAGES } from '@/features/account/account.rules'

export const LICENSE_MESSAGES = {
  pageTitle: 'Lizenzübersicht',
  // Assign dialog (AC-4)
  assignAction: 'Lizenz zuweisen',
  assignDescription: 'Geben Sie die E-Mail-Adresse des Teilnehmers ein.',
  emailLabel: 'E-Mail-Adresse des Teilnehmers',
  cancel: 'Abbrechen',
  assignSubmit: 'Zuweisen',
  // List (AC-2, AC-3)
  emptyList: 'Noch keine Lizenz vergeben. Weisen Sie die erste zu.',
  listSection: 'Vergebene Lizenzen',
  columnEmail: 'E-Mail-Adresse',
  columnAssignedAt: 'Zugewiesen am',
  columnAction: 'Aktion',
  progressLabel: 'Vergebene Lizenzen',
  // Results and field messages (AC-4 to AC-9, EC-1 to EC-6)
  assigned: 'Lizenz zugewiesen',
  emailRequired: 'Bitte geben Sie die E-Mail-Adresse des Teilnehmers ein.',
  emailInvalid: 'Bitte geben Sie eine gültige E-Mail-Adresse ein.',
  alreadyAssigned: 'Diese E-Mail-Adresse hat bereits eine Lizenz.',
  quotaExhaustedNotice:
    'Ihr Kontingent ist ausgeschöpft. Für weitere Lizenzen wenden Sie sich an den Anbieter.',
  quotaExhausted: 'Ihr Kontingent ist ausgeschöpft.',
  quotaExceededNotice:
    'Ihr Kontingent ist überschritten. Bestehende Lizenzen bleiben gültig. Neue können Sie erst zuweisen, wenn weniger Lizenzen vergeben sind, als Ihr Kontingent erlaubt.',
  revoke: 'Entziehen',
  revokeDescription: 'Die Lizenz ist danach sofort wieder frei.',
  revoked: 'Lizenz entzogen',
  alreadyRevoked: 'Diese Lizenz wurde bereits entzogen.',
  noConnection: MESSAGES.noConnection,
  failed: 'Das hat nicht geklappt. Bitte versuchen Sie es erneut.',
  loadFailed: 'Die Lizenzen konnten nicht geladen werden.',
  retry: 'Erneut versuchen',
  unassigned: MESSAGES.unassigned,
} as const

/** The screen-reader name of the "Entziehen" button (AC-8). */
export function revokeLabel(email: string): string {
  return `Lizenz von ${email} entziehen`
}

/** The title of the confirmation dialog (AC-8). */
export function revokeTitle(email: string): string {
  return `Lizenz von ${email} entziehen?`
}

/** The quota notice carries this id; the locked "Lizenz zuweisen" button points to it. */
export const QUOTA_NOTICE_ID = 'license-quota-notice'

export type QuotaState = 'available' | 'exhausted' | 'exceeded'

export type QuotaSummary = {
  assigned: number
  quota: number
  free: number
  percent: number
  state: QuotaState
}

/** Exactly one of three states; only 'available' allows assigning (AC-7, AC-9, EC-4). */
export function quotaSummary(assigned: number, quota: number): QuotaSummary {
  const free = Math.max(0, quota - assigned)
  // With a quota of 0 nothing is left, so the bar is full.
  const percent = quota === 0 ? 100 : Math.min(100, Math.round((assigned / quota) * 100))
  const state: QuotaState = free > 0 ? 'available' : assigned > quota ? 'exceeded' : 'exhausted'
  return { assigned, quota, free, percent, state }
}

/** 'X von Y Lizenzen vergeben', with 'Lizenz' when Y is 1 (AC-1). */
export function assignedText({ assigned, quota }: QuotaSummary): string {
  return `${assigned} von ${quota} ${quota === 1 ? 'Lizenz' : 'Lizenzen'} vergeben`
}

/** 'Z frei' (AC-1). */
export function freeText({ free }: QuotaSummary): string {
  return `${free} frei`
}

// The server may run in UTC; without a fixed zone a licence from 0:30 would show the day before.
const assignedDateFormat = new Intl.DateTimeFormat('de-DE', {
  timeZone: 'Europe/Berlin',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

/** 'TT.MM.JJJJ' in Europe/Berlin (AC-2). */
export function formatAssignedDate(value: string | Date): string {
  return assignedDateFormat.format(new Date(value))
}

export type AssignResult =
  | { status: 'assigned' }
  | { status: 'field_error'; message: string }
  | { status: 'exhausted' }
  | { status: 'unassigned' }
  | { status: 'failed' }

export type RevokeResult =
  | { status: 'revoked' }
  | { status: 'already_revoked' }
  | { status: 'unassigned' }
  | { status: 'failed' }

/**
 * What a dialog shows (design.md → "Darstellung der Ergebnisse"): 'success' and 'error_toast'
 * close it with a toast, 'field' stands at the field, 'alert' in a box in the dialog. With
 * 'field' and 'alert' the dialog stays open and the input stays.
 */
export type Feedback =
  | { kind: 'success'; message: string }
  | { kind: 'error_toast'; message: string }
  | { kind: 'field'; message: string }
  | { kind: 'alert'; message: string }

export function assignFeedback(result: AssignResult): Feedback {
  switch (result.status) {
    case 'assigned':
      return { kind: 'success', message: LICENSE_MESSAGES.assigned }
    case 'field_error':
      return { kind: 'field', message: result.message }
    case 'exhausted':
      return { kind: 'error_toast', message: LICENSE_MESSAGES.quotaExhausted }
    case 'unassigned':
      return { kind: 'error_toast', message: LICENSE_MESSAGES.unassigned }
    case 'failed':
      return { kind: 'alert', message: LICENSE_MESSAGES.failed }
  }
}

export function revokeFeedback(result: RevokeResult): Feedback {
  switch (result.status) {
    case 'revoked':
      return { kind: 'success', message: LICENSE_MESSAGES.revoked }
    case 'already_revoked':
      return { kind: 'error_toast', message: LICENSE_MESSAGES.alreadyRevoked }
    case 'unassigned':
      return { kind: 'error_toast', message: LICENSE_MESSAGES.unassigned }
    case 'failed':
      return { kind: 'alert', message: LICENSE_MESSAGES.failed }
  }
}

/**
 * A call that threw instead of answering (EC-5): no answer at all (fetch fails with a TypeError)
 * is "Keine Verbindung", anything else "Das hat nicht geklappt". The redirect after
 * `redirect()` is not an error; the components recognise it before calling this.
 */
export function thrownFeedback(error: unknown): Feedback {
  return {
    kind: 'alert',
    message: error instanceof TypeError ? LICENSE_MESSAGES.noConnection : LICENSE_MESSAGES.failed,
  }
}
