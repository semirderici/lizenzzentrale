// @vitest-environment node
import {
  LICENSE_MESSAGES,
  QUOTA_NOTICE_ID,
  assignFeedback,
  assignedText,
  formatAssignedDate,
  freeText,
  quotaSummary,
  revokeFeedback,
  revokeLabel,
  revokeTitle,
  thrownFeedback,
} from './licenses.rules'

// The literal German texts, so a typo in LICENSE_MESSAGES fails here (design.md → "Meldungstexte").
const ASSIGNED = 'Lizenz zugewiesen'
const QUOTA_EXHAUSTED = 'Ihr Kontingent ist ausgeschöpft.'
const UNASSIGNED = 'Ihr Konto ist keinem Bildungsträger zugeordnet. Bitte wenden Sie sich an den Anbieter.'
const FAILED = 'Das hat nicht geklappt. Bitte versuchen Sie es erneut.'
const NO_CONNECTION = 'Keine Verbindung. Bitte versuchen Sie es erneut.'
const REVOKED = 'Lizenz entzogen'
const ALREADY_REVOKED = 'Diese Lizenz wurde bereits entzogen.'
const ALREADY_ASSIGNED = 'Diese E-Mail-Adresse hat bereits eine Lizenz.'
// The second line of "Lizenz zugewiesen" (PROJ-3 design.md → "Meldungstexte").
const INVITATION_SENT = 'Die Einladung ist versendet.'
const INVITATION_FAILED =
  'Die Einladung konnte nicht versendet werden. Sie können sie in der Liste erneut senden.'

describe('LICENSE_MESSAGES', () => {
  it('enthält jeden Text wortgleich aus design.md in der Sie-Form, „Keine Verbindung“ und „nicht zugeordnet“ aus PROJ-1 (AC-1 bis AC-9, EC-1, EC-3, EC-5 bis EC-7)', () => {
    expect(LICENSE_MESSAGES).toStrictEqual({
      pageTitle: 'Lizenzübersicht',
      assignAction: 'Lizenz zuweisen',
      assignDescription: 'Geben Sie die E-Mail-Adresse des Teilnehmers ein.',
      emailLabel: 'E-Mail-Adresse des Teilnehmers',
      cancel: 'Abbrechen',
      assignSubmit: 'Zuweisen',
      emptyList: 'Noch keine Lizenz vergeben. Weisen Sie die erste zu.',
      listSection: 'Vergebene Lizenzen',
      columnEmail: 'E-Mail-Adresse',
      columnAssignedAt: 'Zugewiesen am',
      columnAction: 'Aktion',
      progressLabel: 'Vergebene Lizenzen',
      assigned: ASSIGNED,
      emailRequired: 'Bitte geben Sie die E-Mail-Adresse des Teilnehmers ein.',
      emailInvalid: 'Bitte geben Sie eine gültige E-Mail-Adresse ein.',
      alreadyAssigned: ALREADY_ASSIGNED,
      quotaExhaustedNotice:
        'Ihr Kontingent ist ausgeschöpft. Für weitere Lizenzen wenden Sie sich an den Anbieter.',
      quotaExhausted: QUOTA_EXHAUSTED,
      quotaExceededNotice:
        'Ihr Kontingent ist überschritten. Bestehende Lizenzen bleiben gültig. Neue können Sie erst zuweisen, wenn weniger Lizenzen vergeben sind, als Ihr Kontingent erlaubt.',
      revoke: 'Entziehen',
      revokeDescription: 'Die Lizenz ist danach sofort wieder frei.',
      revoked: REVOKED,
      alreadyRevoked: ALREADY_REVOKED,
      noConnection: NO_CONNECTION,
      failed: FAILED,
      loadFailed: 'Die Lizenzen konnten nicht geladen werden.',
      retry: 'Erneut versuchen',
      unassigned: UNASSIGNED,
    })
  })

  it('nennt die Adresse im Namen des Knopfs und im Titel des Bestätigungsdialogs (AC-8)', () => {
    expect(revokeLabel('teilnehmer@example.com')).toBe('Lizenz von teilnehmer@example.com entziehen')
    expect(revokeTitle('teilnehmer@example.com')).toBe('Lizenz von teilnehmer@example.com entziehen?')
  })

  it('hat eine feste ID für den Kontingent-Hinweis', () => {
    expect(QUOTA_NOTICE_ID).toBe('license-quota-notice')
  })
})

describe('quotaSummary', () => {
  it('2 von 5: 3 frei, 40 %, verfügbar (AC-1)', () => {
    expect(quotaSummary(2, 5)).toEqual({ assigned: 2, quota: 5, free: 3, percent: 40, state: 'available' })
  })

  it('0 von 5: 5 frei, 0 %, verfügbar (AC-3)', () => {
    expect(quotaSummary(0, 5)).toEqual({ assigned: 0, quota: 5, free: 5, percent: 0, state: 'available' })
  })

  it('5 von 5: 0 frei, 100 %, ausgeschöpft (AC-7)', () => {
    expect(quotaSummary(5, 5)).toEqual({ assigned: 5, quota: 5, free: 0, percent: 100, state: 'exhausted' })
  })

  it('5 von 3: 0 frei statt negativ, Balken höchstens 100 %, überschritten (AC-9)', () => {
    expect(quotaSummary(5, 3)).toEqual({ assigned: 5, quota: 3, free: 0, percent: 100, state: 'exceeded' })
  })

  it('0 von 0: ausgeschöpft, nicht überschritten, Balken auf 100 % (EC-4)', () => {
    expect(quotaSummary(0, 0)).toEqual({ assigned: 0, quota: 0, free: 0, percent: 100, state: 'exhausted' })
  })

  // Added by /qa: the last free licence (EC-1) and a quota lowered to 0 below assigned licences (AC-9).
  it('4 von 5: die letzte freie Lizenz, noch verfügbar (EC-1)', () => {
    expect(quotaSummary(4, 5)).toEqual({ assigned: 4, quota: 5, free: 1, percent: 80, state: 'available' })
  })

  it('2 von 0: überschritten, nicht ausgeschöpft, Balken auf 100 % (AC-9)', () => {
    expect(quotaSummary(2, 0)).toEqual({ assigned: 2, quota: 0, free: 0, percent: 100, state: 'exceeded' })
    expect(assignedText(quotaSummary(2, 0))).toBe('2 von 0 Lizenzen vergeben')
  })

  it('rundet den Anteil auf ganze Prozent', () => {
    expect(quotaSummary(1, 3).percent).toBe(33)
    expect(quotaSummary(2, 3).percent).toBe(67)
  })
})

describe('Text der Anzeige', () => {
  it('„X von Y Lizenzen vergeben“ und „Z frei“ (AC-1, AC-9)', () => {
    expect(assignedText(quotaSummary(2, 5))).toBe('2 von 5 Lizenzen vergeben')
    expect(freeText(quotaSummary(2, 5))).toBe('3 frei')
    expect(assignedText(quotaSummary(5, 3))).toBe('5 von 3 Lizenzen vergeben')
    expect(freeText(quotaSummary(5, 3))).toBe('0 frei')
  })

  it('bei einem Kontingent von 1 heißt es „Lizenz“, bei 0 „Lizenzen“ (EC-4)', () => {
    expect(assignedText(quotaSummary(0, 1))).toBe('0 von 1 Lizenz vergeben')
    expect(assignedText(quotaSummary(1, 1))).toBe('1 von 1 Lizenz vergeben')
    expect(assignedText(quotaSummary(0, 0))).toBe('0 von 0 Lizenzen vergeben')
  })
})

describe('formatAssignedDate', () => {
  it('zeigt TT.MM.JJJJ in Europe/Berlin, auch wenn es in UTC noch der Vortag ist (AC-2)', () => {
    expect(formatAssignedDate('2026-12-31T23:30:00Z')).toBe('01.01.2027')
    expect(formatAssignedDate(new Date('2026-12-31T22:59:00Z'))).toBe('31.12.2026')
  })

  it('beachtet die Sommerzeit', () => {
    expect(formatAssignedDate('2026-07-14T22:30:00Z')).toBe('15.07.2026')
    expect(formatAssignedDate('2026-07-14T21:59:00Z')).toBe('14.07.2026')
  })
})

describe('Darstellung der Ergebnisse', () => {
  it('Zuweisen: Erfolg schließt mit Toast, „schon vergeben“ steht am Feld, „ausgeschöpft“ und „nicht zugeordnet“ als Fehler-Toast, ein Fehler im Dialog (AC-4, AC-6, EC-1, EC-5, EC-7)', () => {
    expect(assignFeedback({ status: 'assigned', invitation: { status: 'sent' } })).toEqual({
      kind: 'success',
      message: ASSIGNED,
      description: INVITATION_SENT,
    })
    expect(assignFeedback({ status: 'field_error', message: ALREADY_ASSIGNED })).toEqual({
      kind: 'field',
      message: ALREADY_ASSIGNED,
    })
    expect(assignFeedback({ status: 'exhausted' })).toEqual({ kind: 'error_toast', message: QUOTA_EXHAUSTED })
    expect(assignFeedback({ status: 'unassigned' })).toEqual({ kind: 'error_toast', message: UNASSIGNED })
    expect(assignFeedback({ status: 'failed' })).toEqual({ kind: 'alert', message: FAILED })
  })

  describe('Zuweisen mit Einladung (PROJ-3)', () => {
    it('versendet: Erfolg „Lizenz zugewiesen“ mit dem Zusatz „Die Einladung ist versendet.“ (AC-1)', () => {
      expect(assignFeedback({ status: 'assigned', invitation: { status: 'sent' } })).toStrictEqual({
        kind: 'success',
        message: ASSIGNED,
        description: INVITATION_SENT,
      })
    })

    it('fehlgeschlagen: Warnung „Lizenz zugewiesen“, der Zusatz verweist auf „Erneut senden“ in der Liste (AC-3, EC-9)', () => {
      expect(assignFeedback({ status: 'assigned', invitation: { status: 'failed' } })).toStrictEqual({
        kind: 'warning',
        message: ASSIGNED,
        description: INVITATION_FAILED,
      })
    })

    it('Grenze des Trägers: Warnung „Lizenz zugewiesen“ mit der Begründung und dem Zeitpunkt, aufgerundet in Europe/Berlin (AC-8)', () => {
      expect(
        assignFeedback({
          status: 'assigned',
          invitation: { status: 'provider_limit', availableFrom: '2026-10-28T13:11:56.123Z' },
        })
      ).toStrictEqual({
        kind: 'warning',
        message: ASSIGNED,
        description:
          'Die Einladung wurde nicht versendet, weil Ihr Bildungsträger in den letzten 24 Stunden bereits 30 Einladungen versendet hat. Sie können sie ab 28.10.2026, 14:12 Uhr senden.',
      })
    })

    it.each([
      ['nicht gefunden', { status: 'not_found' } as const],
      ['läuft schon', { status: 'already_sending' } as const],
      ['Grenze der Lizenz', { status: 'license_limit', availableFrom: '2026-10-28T13:11:56.123Z' } as const],
    ])('%s (kommt bei einer neuen Lizenz nicht vor): wie „fehlgeschlagen“', (_case, invitation) => {
      expect(assignFeedback({ status: 'assigned', invitation })).toStrictEqual({
        kind: 'warning',
        message: ASSIGNED,
        description: INVITATION_FAILED,
      })
    })
  })

  it('Entziehen: Erfolg schließt mit Toast, „bereits entzogen“ und „nicht zugeordnet“ als Fehler-Toast, ein Fehler im Dialog (AC-8, EC-3, EC-5, EC-7)', () => {
    expect(revokeFeedback({ status: 'revoked' })).toEqual({ kind: 'success', message: REVOKED })
    expect(revokeFeedback({ status: 'already_revoked' })).toEqual({ kind: 'error_toast', message: ALREADY_REVOKED })
    expect(revokeFeedback({ status: 'unassigned' })).toEqual({ kind: 'error_toast', message: UNASSIGNED })
    expect(revokeFeedback({ status: 'failed' })).toEqual({ kind: 'alert', message: FAILED })
  })

  it('keine Antwort vom App-Server ist „Keine Verbindung“, jeder andere Fehler „Das hat nicht geklappt“ (EC-5)', () => {
    expect(thrownFeedback(new TypeError('Failed to fetch'))).toEqual({ kind: 'alert', message: NO_CONNECTION })
    expect(thrownFeedback(new Error('An unexpected response was received from the server.'))).toEqual({
      kind: 'alert',
      message: FAILED,
    })
    expect(thrownFeedback(undefined)).toEqual({ kind: 'alert', message: FAILED })
  })
})
