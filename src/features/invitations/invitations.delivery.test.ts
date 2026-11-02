// @vitest-environment node
// Tests for sending one invitation with the data access and Mailjet replaced; the mail module is
// the real one. Which order the steps run in, what goes to Mailjet, that a reserved send is
// finished exactly once, and that nothing ever throws or reaches the console with an address or
// a name in it.
import { buildInvitationMail } from './invitation-mail.rules'
import type { BeginInvitationResult } from './invitations.data'
import { deliverInvitation } from './invitations.delivery'
import type { MailjetMessage, MailjetVerdict } from './mailjet.integration'

// Set before the module is loaded: an implementation that reads the link at load time would use
// this value instead of the one each test sets.
vi.hoisted(() => {
  vi.stubEnv('LEARNING_PLATFORM_URL', 'https://beim-laden.example.org/')
})

const mocks = vi.hoisted(() => ({
  beginInvitation: vi.fn<(trainingProviderId: string, licenseId: string) => Promise<BeginInvitationResult>>(),
  finishInvitation: vi.fn<(sendId: number, accepted: boolean) => Promise<boolean>>(),
  sendMail: vi.fn<(message: MailjetMessage) => Promise<MailjetVerdict>>(),
}))

vi.mock('./invitations.data', () => ({
  beginInvitation: mocks.beginInvitation,
  finishInvitation: mocks.finishInvitation,
}))
vi.mock('./mailjet.integration', () => ({ sendMail: mocks.sendMail }))

const { beginInvitation, finishInvitation, sendMail } = mocks

const TRAINING_PROVIDER = { id: '6f0c2f61-3a52-4c51-9d0a-2b7f4e1c9a11', name: 'Bildungswerk Nordlicht & Söhne GmbH' }
const LICENSE_ID = '0b9a7c3e-1d2f-4e5a-8b6c-7d8e9f0a1b2c'
const SEND_ID = 4711
// Deliberately unusual, so any change to it on the way to Mailjet shows (EC-8).
const EMAIL = 'Vorname.Nachname+kurs@Mail.Sub.Example.com'
const PLATFORM_URL = 'https://lernen.example.org/kurs/technischer-betriebswirt'
const UNEXPECTED_ERROR = 'Einladung: unerwarteter Fehler beim Versand'
const INVALID_PLATFORM_URL = 'Einladung: Linkziel nicht eingestellt oder ungültig (LEARNING_PLATFORM_URL)'

const ALLOWED: BeginInvitationResult = { status: 'allowed', sendId: SEND_ID, email: EMAIL }

/** A thrown error carrying the address and the name, so logging it would show in the console checks. */
function leakyError() {
  return new Error(`Fehler für ${EMAIL} von ${TRAINING_PROVIDER.name}`)
}

const consoleSpies = {
  error: vi.spyOn(console, 'error'),
  warn: vi.spyOn(console, 'warn'),
  log: vi.spyOn(console, 'log'),
  info: vi.spyOn(console, 'info'),
}

/** Every argument of every console call, as text. */
function consoleOutput(): string[] {
  return Object.values(consoleSpies).flatMap((spy) =>
    spy.mock.calls.flatMap((call) =>
      call.map((argument) => (argument instanceof Error ? `${argument.message} ${argument.stack}` : String(argument))),
    ),
  )
}

function expectNoConsoleOutput() {
  expect(consoleOutput()).toStrictEqual([])
}

/** Exactly the one fixed line for an unexpected exception, nothing else, no address, no name. */
function expectOneUnexpectedErrorLine() {
  expect(consoleSpies.error.mock.calls).toStrictEqual([[UNEXPECTED_ERROR]])
  expect(consoleOutput()).toStrictEqual([UNEXPECTED_ERROR])
}

function expectNothingLeaked() {
  for (const line of consoleOutput()) {
    expect(line).not.toContain(EMAIL)
    expect(line.toLowerCase()).not.toContain(EMAIL.toLowerCase())
    expect(line).not.toContain(TRAINING_PROVIDER.name)
    expect(line).not.toContain('Nordlicht')
  }
}

beforeEach(() => {
  beginInvitation.mockReset().mockResolvedValue(ALLOWED)
  finishInvitation.mockReset().mockResolvedValue(true)
  sendMail.mockReset().mockResolvedValue('accepted')
  for (const spy of Object.values(consoleSpies)) spy.mockReset().mockImplementation(() => {})
  vi.stubEnv('LEARNING_PLATFORM_URL', PLATFORM_URL)
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('deliverInvitation', () => {
  it('beginnt mit Träger-ID und Lizenz-ID, sendet an genau die zurückgegebene Adresse und meldet „versendet“ (AC-1, AC-9, EC-8)', async () => {
    await expect(deliverInvitation(TRAINING_PROVIDER, LICENSE_ID)).resolves.toStrictEqual({ status: 'sent' })

    expect(beginInvitation.mock.calls).toStrictEqual([[TRAINING_PROVIDER.id, LICENSE_ID]])
    const mail = buildInvitationMail(TRAINING_PROVIDER.name, PLATFORM_URL)
    expect(sendMail.mock.calls).toStrictEqual([
      [{ to: EMAIL, subject: mail.subject, text: mail.text, html: mail.html }],
    ])
    expect(finishInvitation.mock.calls).toStrictEqual([[SEND_ID, true]])
    expectNoConsoleOutput()
  })

  it('schließt erst ab, nachdem Mailjet geantwortet hat', async () => {
    await deliverInvitation(TRAINING_PROVIDER, LICENSE_ID)

    const [begun] = beginInvitation.mock.invocationCallOrder
    const [sent] = sendMail.mock.invocationCallOrder
    const [finished] = finishInvitation.mock.invocationCallOrder
    expect(begun).toBeLessThan(sent)
    expect(sent).toBeLessThan(finished)
  })

  it('nimmt Mailjet die Mail nicht an, ist der Ausgang „fehlgeschlagen“ und der Versand wird als nicht angenommen abgeschlossen (AC-3)', async () => {
    sendMail.mockResolvedValue('failed')

    await expect(deliverInvitation(TRAINING_PROVIDER, LICENSE_ID)).resolves.toStrictEqual({ status: 'failed' })

    expect(sendMail).toHaveBeenCalledTimes(1)
    expect(finishInvitation.mock.calls).toStrictEqual([[SEND_ID, false]])
    expectNoConsoleOutput()
  })

  it('antwortet die Beginn-Funktion mit einem Fehler, ist der Ausgang „fehlgeschlagen“, ohne Mail und ohne Abschluss', async () => {
    beginInvitation.mockResolvedValue({ status: 'error' })

    await expect(deliverInvitation(TRAINING_PROVIDER, LICENSE_ID)).resolves.toStrictEqual({ status: 'failed' })

    expect(sendMail).not.toHaveBeenCalled()
    expect(finishInvitation).not.toHaveBeenCalled()
    expectNoConsoleOutput()
  })

  it.each<[string, BeginInvitationResult]>([
    ['nicht gefunden (EC-5)', { status: 'not_found' }],
    ['läuft schon (EC-1)', { status: 'already_sending' }],
    ['Grenze der Lizenz (AC-7)', { status: 'license_limit', availableFrom: '2026-10-28T09:15:30.000Z' }],
    ['Grenze des Trägers (AC-8, EC-2)', { status: 'provider_limit', availableFrom: '2026-10-28T17:02:00.000Z' }],
  ])('gibt die Ablehnung „%s“ unverändert zurück, ohne Mail und ohne Abschluss', async (_case, refusal) => {
    beginInvitation.mockResolvedValue(refusal)

    await expect(deliverInvitation(TRAINING_PROVIDER, LICENSE_ID)).resolves.toStrictEqual(refusal)

    expect(sendMail).not.toHaveBeenCalled()
    expect(finishInvitation).not.toHaveBeenCalled()
    expectNoConsoleOutput()
  })

  it.each<[string, string | undefined]>([
    ['nicht gesetzt', undefined],
    ['leer', ''],
    ['javascript:', 'javascript:alert(1)'],
    ['relativ', '/lernen/kurs'],
  ])('ist das Linkziel %s, geht keine Mail an Mailjet, der Versand wird abgeschlossen und ist „fehlgeschlagen“ (EC-9)', async (_case, value) => {
    vi.stubEnv('LEARNING_PLATFORM_URL', value)

    await expect(deliverInvitation(TRAINING_PROVIDER, LICENSE_ID)).resolves.toStrictEqual({ status: 'failed' })

    expect(beginInvitation).toHaveBeenCalledTimes(1)
    expect(sendMail).not.toHaveBeenCalled()
    expect(finishInvitation.mock.calls).toStrictEqual([[SEND_ID, false]])
    // BUG-4: one fixed line names the cause, never the value (design.md → Technische Entscheidungen).
    expect(consoleSpies.error.mock.calls).toStrictEqual([[INVALID_PLATFORM_URL]])
    expect(consoleOutput()).toStrictEqual([INVALID_PLATFORM_URL])
  })

  it('liest das Linkziel bei jedem Aufruf, nicht beim Laden des Moduls', async () => {
    const other = 'https://andere-plattform.example.net/start'

    await deliverInvitation(TRAINING_PROVIDER, LICENSE_ID)
    vi.stubEnv('LEARNING_PLATFORM_URL', other)
    await deliverInvitation(TRAINING_PROVIDER, LICENSE_ID)

    expect(sendMail.mock.calls.map(([message]) => message.html)).toStrictEqual([
      buildInvitationMail(TRAINING_PROVIDER.name, PLATFORM_URL).html,
      buildInvitationMail(TRAINING_PROVIDER.name, other).html,
    ])
  })

  it('setzt das geprüfte, normalisierte Linkziel in die Mail', async () => {
    vi.stubEnv('LEARNING_PLATFORM_URL', 'https://Lernen.Example.ORG')

    await expect(deliverInvitation(TRAINING_PROVIDER, LICENSE_ID)).resolves.toStrictEqual({ status: 'sent' })

    const mail = buildInvitationMail(TRAINING_PROVIDER.name, 'https://lernen.example.org/')
    expect(sendMail.mock.calls).toStrictEqual([
      [{ to: EMAIL, subject: mail.subject, text: mail.text, html: mail.html }],
    ])
  })

  it.each<[MailjetVerdict, 'sent' | 'failed']>([
    ['accepted', 'sent'],
    ['failed', 'failed'],
  ])('scheitert der Abschluss, folgt der Ausgang trotzdem Mailjet: %s → %s (EC-3)', async (verdict, outcome) => {
    sendMail.mockResolvedValue(verdict)
    finishInvitation.mockResolvedValue(false)

    await expect(deliverInvitation(TRAINING_PROVIDER, LICENSE_ID)).resolves.toStrictEqual({ status: outcome })

    expect(finishInvitation.mock.calls).toStrictEqual([[SEND_ID, verdict === 'accepted']])
    expectNoConsoleOutput()
  })

  it.each<[MailjetVerdict, 'sent' | 'failed']>([
    ['accepted', 'sent'],
    ['failed', 'failed'],
  ])('wirft der Abschluss, folgt der Ausgang trotzdem Mailjet: %s → %s, mit einer festen Zeile im Protokoll', async (verdict, outcome) => {
    sendMail.mockResolvedValue(verdict)
    finishInvitation.mockRejectedValue(leakyError())

    await expect(deliverInvitation(TRAINING_PROVIDER, LICENSE_ID)).resolves.toStrictEqual({ status: outcome })

    expect(finishInvitation).toHaveBeenCalledTimes(1)
    expectOneUnexpectedErrorLine()
  })

  it('wirft die Beginn-Funktion, ist der Ausgang „fehlgeschlagen“, ohne Mail, ohne Abschluss und ohne Ausnahme', async () => {
    beginInvitation.mockRejectedValue(leakyError())

    await expect(deliverInvitation(TRAINING_PROVIDER, LICENSE_ID)).resolves.toStrictEqual({ status: 'failed' })

    expect(sendMail).not.toHaveBeenCalled()
    expect(finishInvitation).not.toHaveBeenCalled()
    expectOneUnexpectedErrorLine()
  })

  it('wirft Mailjet, ist der Ausgang „fehlgeschlagen“ und der Versand wird als nicht angenommen abgeschlossen', async () => {
    sendMail.mockRejectedValue(leakyError())

    await expect(deliverInvitation(TRAINING_PROVIDER, LICENSE_ID)).resolves.toStrictEqual({ status: 'failed' })

    expect(finishInvitation.mock.calls).toStrictEqual([[SEND_ID, false]])
    expectOneUnexpectedErrorLine()
  })

  it('werfen Mailjet und der Abschluss, bleibt es bei „fehlgeschlagen“ und genau einer festen Zeile', async () => {
    sendMail.mockRejectedValue(leakyError())
    finishInvitation.mockRejectedValue(leakyError())

    await expect(deliverInvitation(TRAINING_PROVIDER, LICENSE_ID)).resolves.toStrictEqual({ status: 'failed' })

    expect(finishInvitation.mock.calls).toStrictEqual([[SEND_ID, false]])
    expectOneUnexpectedErrorLine()
  })

  it('schreibt in keinem Fehlerfall die Adresse oder den Namen des Trägers auf die Konsole (O-1)', async () => {
    const scenarios: Array<() => void> = [
      () => beginInvitation.mockRejectedValue(leakyError()),
      () => beginInvitation.mockResolvedValue({ status: 'error' }),
      () => sendMail.mockRejectedValue(leakyError()),
      () => sendMail.mockResolvedValue('failed'),
      () => finishInvitation.mockRejectedValue(leakyError()),
      () => finishInvitation.mockResolvedValue(false),
      () => vi.stubEnv('LEARNING_PLATFORM_URL', 'javascript:alert(1)'),
    ]

    for (const arrange of scenarios) {
      beginInvitation.mockResolvedValue(ALLOWED)
      sendMail.mockResolvedValue('accepted')
      finishInvitation.mockResolvedValue(true)
      vi.stubEnv('LEARNING_PLATFORM_URL', PLATFORM_URL)
      arrange()

      await expect(deliverInvitation(TRAINING_PROVIDER, LICENSE_ID)).resolves.toBeDefined()
    }

    expect(consoleOutput().length).toBeGreaterThan(0)
    expectNothingLeaked()
  })
})
