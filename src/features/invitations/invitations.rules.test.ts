// @vitest-environment node
import { LICENSE_MESSAGES } from '@/features/licenses/licenses.rules'
import {
  INVITATION_MESSAGES,
  assignInvitationNote,
  formatAvailableFrom,
  formatSentDate,
  invitationDisplay,
  licenseLimitMessage,
  providerLimitMessage,
  sendButtonAccessibleLabel,
  sendButtonLabel,
  sendFeedback,
  sendThrownFeedback,
  type DeliveryOutcome,
} from './invitations.rules'

// The literal German texts, so a typo in INVITATION_MESSAGES fails here (design.md → "Meldungstexte").
const NOT_INVITED = 'Noch nicht eingeladen'
const SENDING = 'Wird versendet'
const FAILED_STATE = 'Fehlgeschlagen'
const ASSIGN_SENT = 'Die Einladung ist versendet.'
const ASSIGN_FAILED =
  'Die Einladung konnte nicht versendet werden. Sie können sie in der Liste erneut senden.'
const SENT = 'Einladung versendet'
const SEND_FAILED = 'Die Einladung konnte nicht versendet werden. Bitte versuchen Sie es später erneut.'
const ALREADY_SENDING = 'Die Einladung wird gerade versendet.'
const ALREADY_REVOKED = 'Diese Lizenz wurde bereits entzogen.'
const FAILED = 'Das hat nicht geklappt. Bitte versuchen Sie es erneut.'
const NO_CONNECTION = 'Keine Verbindung. Bitte versuchen Sie es erneut.'
const UNASSIGNED = 'Ihr Konto ist keinem Bildungsträger zugeordnet. Bitte wenden Sie sich an den Anbieter.'

// 08:05 UTC in winter is 09:05 in Berlin (CET, UTC+1).
const AVAILABLE_FROM = '2026-01-15T08:05:00.000Z'
const LICENSE_LIMIT =
  'Diese Einladung wurde in den letzten 24 Stunden bereits dreimal versendet. Sie können sie ab 15.01.2026, 09:05 Uhr erneut senden.'
const PROVIDER_LIMIT =
  'Die Einladung wurde nicht versendet, weil Ihr Bildungsträger in den letzten 24 Stunden bereits 30 Einladungen versendet hat. Sie können sie ab 15.01.2026, 09:05 Uhr senden.'

describe('INVITATION_MESSAGES', () => {
  it('enthält jeden Text wortgleich aus design.md in der Sie-Form, „Keine Verbindung“ und „nicht zugeordnet“ aus PROJ-1 (AC-1, AC-3 bis AC-6, EC-1, EC-3, EC-5, EC-9 bis EC-11)', () => {
    expect(INVITATION_MESSAGES).toStrictEqual({
      columnInvitation: 'Einladung',
      cardLabel: 'Einladung:',
      stateNotInvited: NOT_INVITED,
      stateSending: SENDING,
      stateSentOn: 'Versendet am',
      stateFailed: FAILED_STATE,
      send: 'Einladung senden',
      resend: 'Erneut senden',
      assignSent: ASSIGN_SENT,
      assignFailed: ASSIGN_FAILED,
      sent: SENT,
      sendFailed: SEND_FAILED,
      alreadySending: ALREADY_SENDING,
      alreadyRevoked: ALREADY_REVOKED,
      failed: FAILED,
      noConnection: NO_CONNECTION,
      unassigned: UNASSIGNED,
    })
  })

  it('„bereits entzogen“ und „Das hat nicht geklappt“ sind dieselben Texte wie in PROJ-2', () => {
    expect(INVITATION_MESSAGES.alreadyRevoked).toBe(LICENSE_MESSAGES.alreadyRevoked)
    expect(INVITATION_MESSAGES.failed).toBe(LICENSE_MESSAGES.failed)
  })
})

describe('invitationDisplay', () => {
  const now = new Date('2026-10-27T10:00:00.000Z')

  it('ohne Versandstand: „Noch nicht eingeladen“ mit „Einladung senden“ (AC-6)', () => {
    expect(invitationDisplay(null, now)).toEqual({ state: 'not_invited', label: NOT_INVITED, action: 'send' })
  })

  it.each([
    ['gerade begonnen', '2026-10-27T10:00:00.000Z'],
    ['1:59,999 Minuten alt', '2026-10-27T09:58:00.001Z'],
  ])('„sending“ %s: „Wird versendet“ ohne Aktion (AC-4, EC-1)', (_case, lastAttemptAt) => {
    expect(invitationDisplay({ status: 'sending', lastAttemptAt }, now)).toEqual({
      state: 'sending',
      label: SENDING,
      action: null,
    })
  })

  it.each([
    ['genau 2 Minuten alt', '2026-10-27T09:58:00.000Z'],
    ['3 Minuten alt', '2026-10-27T09:57:00.000Z'],
    ['ohne lesbaren Zeitpunkt', 'kein Zeitpunkt'],
  ])('„sending“ %s gilt als hängen geblieben: „Fehlgeschlagen“ mit „Erneut senden“ (EC-3)', (_case, lastAttemptAt) => {
    expect(invitationDisplay({ status: 'sending', lastAttemptAt }, now)).toEqual({
      state: 'failed',
      label: FAILED_STATE,
      action: 'resend',
    })
  })

  it('„sent“: „Versendet am TT.MM.JJJJ“ mit „Erneut senden“ und dem vollen Zeitpunkt (AC-1, AC-4)', () => {
    expect(invitationDisplay({ status: 'sent', lastAttemptAt: '2026-10-26T09:15:00.000Z' }, now)).toEqual({
      state: 'sent',
      label: 'Versendet am 26.10.2026',
      sentAt: '2026-10-26T09:15:00.000Z',
      date: '26.10.2026',
      action: 'resend',
    })
  })

  it('„sent“ um 23:30 Uhr UTC am 31.12. steht mit dem Datum in Berlin da', () => {
    expect(invitationDisplay({ status: 'sent', lastAttemptAt: '2026-12-31T23:30:00.000Z' }, now)).toMatchObject({
      label: 'Versendet am 01.01.2027',
      date: '01.01.2027',
    })
  })

  it('„failed“: „Fehlgeschlagen“ mit „Erneut senden“, auch kurz nach dem Versuch (AC-3, AC-4)', () => {
    expect(invitationDisplay({ status: 'failed', lastAttemptAt: '2026-10-27T09:59:59.000Z' }, now)).toEqual({
      state: 'failed',
      label: FAILED_STATE,
      action: 'resend',
    })
  })
})

describe('formatSentDate', () => {
  it('zeigt TT.MM.JJJJ in Europe/Berlin, auch wenn es in UTC noch der Vortag ist', () => {
    expect(formatSentDate('2026-12-31T23:30:00Z')).toBe('01.01.2027')
    expect(formatSentDate(new Date('2026-12-31T22:59:00Z'))).toBe('31.12.2026')
  })

  it('beachtet die Sommerzeit', () => {
    expect(formatSentDate('2026-07-14T22:30:00Z')).toBe('15.07.2026')
    expect(formatSentDate('2026-07-14T21:59:00Z')).toBe('14.07.2026')
  })
})

describe('formatAvailableFrom', () => {
  it('eine volle Minute bleibt, wie sie ist (Winterzeit, UTC+1)', () => {
    expect(formatAvailableFrom('2026-01-15T08:05:00.000Z')).toBe('15.01.2026, 09:05 Uhr')
  })

  it('eine Millisekunde nach der vollen Minute ergibt die nächste Minute', () => {
    expect(formatAvailableFrom('2026-01-15T08:05:00.001Z')).toBe('15.01.2026, 09:06 Uhr')
    expect(formatAvailableFrom(new Date('2026-01-15T08:05:59.999Z'))).toBe('15.01.2026, 09:06 Uhr')
  })

  it('23:59:30 Uhr in Berlin ergibt 00:00 Uhr des Folgetags, auch über den Jahreswechsel', () => {
    expect(formatAvailableFrom('2026-12-31T22:59:30.000Z')).toBe('01.01.2027, 00:00 Uhr')
  })

  it('beachtet die Sommerzeit (UTC+2)', () => {
    expect(formatAvailableFrom('2026-07-14T08:05:00.000Z')).toBe('14.07.2026, 10:05 Uhr')
    expect(formatAvailableFrom('2026-07-14T21:59:30.000Z')).toBe('15.07.2026, 00:00 Uhr')
  })

  it('rundet über die Umstellung auf Sommerzeit hinweg auf (01:59:30 Uhr MEZ wird 03:00 Uhr MESZ)', () => {
    expect(formatAvailableFrom('2026-03-29T00:59:30.000Z')).toBe('29.03.2026, 03:00 Uhr')
  })
})

describe('Texte mit Zeitpunkt und Knöpfe', () => {
  it('Grenze der Lizenz mit dem Zeitpunkt „ab“ (AC-7)', () => {
    expect(licenseLimitMessage(AVAILABLE_FROM)).toBe(LICENSE_LIMIT)
  })

  it('Grenze des Trägers mit dem Zeitpunkt „ab“ (AC-8)', () => {
    expect(providerLimitMessage(new Date(AVAILABLE_FROM))).toBe(PROVIDER_LIMIT)
  })

  it('sichtbarer Text „Einladung senden“ bzw. „Erneut senden“ (AC-4, AC-6)', () => {
    expect(sendButtonLabel('send')).toBe('Einladung senden')
    expect(sendButtonLabel('resend')).toBe('Erneut senden')
  })

  it('der Name für den Screenreader nennt die Adresse (AC-4, AC-6)', () => {
    expect(sendButtonAccessibleLabel('send', 'vorname.nachname+kurs@example.com')).toBe(
      'Einladung an vorname.nachname+kurs@example.com senden',
    )
    expect(sendButtonAccessibleLabel('resend', 'vorname.nachname+kurs@example.com')).toBe(
      'Einladung an vorname.nachname+kurs@example.com erneut senden',
    )
  })
})

describe('sendFeedback', () => {
  it('versendet: Erfolgs-Toast „Einladung versendet“ (AC-5)', () => {
    expect(sendFeedback({ status: 'sent' })).toEqual({ kind: 'success', message: SENT })
  })

  it('fehlgeschlagen: Fehler-Toast ohne technische Meldung (AC-5, EC-9)', () => {
    expect(sendFeedback({ status: 'failed' })).toEqual({ kind: 'error', message: SEND_FAILED })
  })

  it('läuft schon: Fehler-Toast „Die Einladung wird gerade versendet.“ (EC-1)', () => {
    expect(sendFeedback({ status: 'already_sending' })).toEqual({ kind: 'error', message: ALREADY_SENDING })
  })

  it('Grenze der Lizenz: Fehler-Toast mit dem Text aus AC-7 (AC-7)', () => {
    expect(sendFeedback({ status: 'license_limit', availableFrom: AVAILABLE_FROM })).toEqual({
      kind: 'error',
      message: LICENSE_LIMIT,
    })
  })

  it('Grenze des Trägers: Fehler-Toast mit der Begründung aus AC-8 (AC-8)', () => {
    expect(sendFeedback({ status: 'provider_limit', availableFrom: AVAILABLE_FROM })).toEqual({
      kind: 'error',
      message: PROVIDER_LIMIT,
    })
  })

  it.each(['already_revoked', 'not_found'] as const)(
    '%s: Fehler-Toast „Diese Lizenz wurde bereits entzogen.“ (EC-5)',
    (status) => {
      expect(sendFeedback({ status })).toEqual({ kind: 'error', message: ALREADY_REVOKED })
    },
  )

  it('nicht zugeordnet: Fehler-Toast mit der Meldung aus PROJ-1 (EC-11)', () => {
    expect(sendFeedback({ status: 'unassigned' })).toEqual({ kind: 'error', message: UNASSIGNED })
  })

  it('Fehler: Fehler-Toast „Das hat nicht geklappt. Bitte versuchen Sie es erneut.“', () => {
    expect(sendFeedback({ status: 'error' })).toEqual({ kind: 'error', message: FAILED })
  })
})

describe('sendThrownFeedback', () => {
  it('keine Antwort vom App-Server ist „Keine Verbindung“ (EC-10)', () => {
    expect(sendThrownFeedback(new TypeError('Failed to fetch'))).toEqual({ kind: 'error', message: NO_CONNECTION })
  })

  it('jeder andere Fehler ist „Das hat nicht geklappt“', () => {
    expect(sendThrownFeedback(new Error('An unexpected response was received from the server.'))).toEqual({
      kind: 'error',
      message: FAILED,
    })
    expect(sendThrownFeedback(undefined)).toEqual({ kind: 'error', message: FAILED })
  })
})

describe('assignInvitationNote', () => {
  it('versendet: Erfolg mit „Die Einladung ist versendet.“ (AC-1)', () => {
    expect(assignInvitationNote({ status: 'sent' })).toEqual({ kind: 'success', description: ASSIGN_SENT })
  })

  it('Grenze des Trägers: Warnung mit der Begründung aus AC-8 und dem Zeitpunkt (AC-8)', () => {
    expect(assignInvitationNote({ status: 'provider_limit', availableFrom: AVAILABLE_FROM })).toEqual({
      kind: 'warning',
      description: PROVIDER_LIMIT,
    })
  })

  it.each<DeliveryOutcome>([
    { status: 'failed' },
    { status: 'not_found' },
    { status: 'already_sending' },
    { status: 'license_limit', availableFrom: AVAILABLE_FROM },
  ])('$status: Warnung mit dem Text aus AC-3 (AC-3, EC-9)', (outcome) => {
    expect(assignInvitationNote(outcome)).toEqual({ kind: 'warning', description: ASSIGN_FAILED })
  })
})
