// @vitest-environment node
import {
  MESSAGES,
  clientIpFrom,
  loginFormError,
  registerFormError,
  remainingMinutes,
  tooManyLoginAttemptsMessage,
} from './account.rules'

const NOW = new Date('2026-10-25T10:00:00.000Z')
const after = (milliseconds: number) => new Date(NOW.getTime() + milliseconds)
const SECOND = 1000
const MINUTE = 60 * SECOND

describe('MESSAGES', () => {
  it('enthält jede Meldung wortgleich aus design.md in der Sie-Form (AC-2, AC-3, AC-5, AC-7, AC-8, EC-3, EC-5, EC-6, EC-8, EC-9)', () => {
    expect(MESSAGES).toStrictEqual({
      nameRequired: 'Bitte geben Sie den Namen Ihres Bildungsträgers ein.',
      nameTooShort: 'Der Name muss mindestens 2 Zeichen lang sein.',
      nameTooLong: 'Der Name darf höchstens 100 Zeichen lang sein.',
      emailRequired: 'Bitte geben Sie Ihre E-Mail-Adresse ein.',
      emailInvalid: 'Bitte geben Sie eine gültige E-Mail-Adresse ein.',
      passwordTooShort: 'Das Passwort muss mindestens 8 Zeichen lang sein.',
      passwordTooLong: 'Das Passwort darf höchstens 72 Zeichen lang sein.',
      passwordTooManyBytes:
        'Das Passwort ist zu lang, weil Umlaute und andere besondere Zeichen mehrfach zählen. Bitte kürzen Sie es.',
      passwordConfirmationRequired: 'Bitte wiederholen Sie das Passwort.',
      passwordMismatch: 'Die Passwörter stimmen nicht überein.',
      loginPasswordRequired: 'Bitte geben Sie Ihr Passwort ein.',
      passwordHint: 'Mindestens 8 Zeichen.',
      emailAlreadyRegistered:
        'Mit dieser E-Mail-Adresse ist bereits ein Konto registriert. Bitte melden Sie sich an.',
      toLogin: 'Zum Login',
      invalidCredentials: 'E-Mail-Adresse oder Passwort ist falsch.',
      botCheckFailed: 'Die Sicherheitsprüfung ist fehlgeschlagen. Bitte versuchen Sie es erneut.',
      tooManyRegistrations: 'Zu viele Registrierungen. Bitte versuchen Sie es später erneut.',
      registrationFailed: 'Die Registrierung ist fehlgeschlagen. Bitte versuchen Sie es erneut.',
      loginFailed: 'Die Anmeldung ist fehlgeschlagen. Bitte versuchen Sie es erneut.',
      noConnection: 'Keine Verbindung. Bitte versuchen Sie es erneut.',
      unassigned: 'Ihr Konto ist keinem Bildungsträger zugeordnet. Bitte wenden Sie sich an den Anbieter.',
      sessionEnded: 'Bitte melden Sie sich erneut an.',
      botCheckUnavailable: 'Die Sicherheitsprüfung konnte nicht geladen werden. Bitte laden Sie die Seite neu.',
    })
  })
})

describe('remainingMinutes', () => {
  it.each([
    ['15 Minuten', 15 * MINUTE, 15],
    ['14 Minuten 1 Sekunde', 14 * MINUTE + SECOND, 15],
    ['61 Sekunden', 61 * SECOND, 2],
    ['60 Sekunden', 60 * SECOND, 1],
    ['1 Sekunde', SECOND, 1],
    ['1 Millisekunde', 1, 1],
  ])('rundet %s Restzeit auf ganze Minuten auf (AC-6)', (_, left, minutes) => {
    expect(remainingMinutes(after(left), NOW)).toBe(minutes)
  })

  it.each([
    ['abgelaufen', 0],
    ['vergangen', -5 * MINUTE],
  ])('nennt mindestens 1 Minute, auch wenn die Sperre %s ist (AC-6)', (_, left) => {
    expect(remainingMinutes(after(left), NOW)).toBe(1)
  })

  it('nimmt bei einem ungültigen Zeitpunkt die volle Sperrzeit von 15 Minuten an (AC-6)', () => {
    expect(remainingMinutes(new Date('kein Datum'), NOW)).toBe(15)
  })
})

describe('tooManyLoginAttemptsMessage', () => {
  it('nennt 1 Minute in der Einzahl (AC-6)', () => {
    expect(tooManyLoginAttemptsMessage(1)).toBe(
      'Zu viele Anmeldeversuche. Bitte versuchen Sie es in 1 Minute erneut.',
    )
  })

  it.each([
    [2, 'Zu viele Anmeldeversuche. Bitte versuchen Sie es in 2 Minuten erneut.'],
    [5, 'Zu viele Anmeldeversuche. Bitte versuchen Sie es in 5 Minuten erneut.'],
    [15, 'Zu viele Anmeldeversuche. Bitte versuchen Sie es in 15 Minuten erneut.'],
  ])('nennt %i Minuten in der Mehrzahl (AC-6)', (minutes, message) => {
    expect(tooManyLoginAttemptsMessage(minutes)).toBe(message)
  })

  it('macht aus Bruchteilen und Werten unter 1 ganze Minuten, mindestens 1 (AC-6)', () => {
    expect(tooManyLoginAttemptsMessage(0)).toBe(
      'Zu viele Anmeldeversuche. Bitte versuchen Sie es in 1 Minute erneut.',
    )
    expect(tooManyLoginAttemptsMessage(1.5)).toBe(
      'Zu viele Anmeldeversuche. Bitte versuchen Sie es in 2 Minuten erneut.',
    )
    expect(tooManyLoginAttemptsMessage(Number.NaN)).toBe(
      'Zu viele Anmeldeversuche. Bitte versuchen Sie es in 15 Minuten erneut.',
    )
  })
})

describe('clientIpFrom', () => {
  it.each([null, undefined, '', '   '])(
    'setzt ohne Kopf die Ersatzadresse 0.0.0.0, nicht öffentlich: %j (AC-6, AC-8)',
    (header) => {
      expect(clientIpFrom(header)).toEqual({ ip: '0.0.0.0', isPublic: false })
    },
  )

  it.each([
    ['8.8.8.8', '8.8.8.8'],
    ['  1.1.1.1  ', '1.1.1.1'],
    ['2001:4860:4860::8888', '2001:4860:4860::8888'],
    ['2606:4700:4700::1111', '2606:4700:4700::1111'],
    ['2001:4860:4860:0:0:0:0:8888', '2001:4860:4860:0:0:0:0:8888'],
    ['::ffff:8.8.8.8', '::ffff:8.8.8.8'],
  ])('erkennt eine öffentliche Adresse: %j (AC-6, AC-8)', (header, ip) => {
    expect(clientIpFrom(header)).toEqual({ ip, isPublic: true })
  })

  it.each([
    ['1.1.1.1, 8.8.8.8', '8.8.8.8', true],
    [' 1.1.1.1 ,  8.8.4.4 ', '8.8.4.4', true],
    ['127.0.0.1, 10.0.0.1, 8.8.8.8', '8.8.8.8', true],
    ['8.8.8.8, 10.0.0.1', '10.0.0.1', false],
    ['8.8.8.8, 2001:4860:4860::8888', '2001:4860:4860::8888', true],
  ])('nimmt den letzten Eintrag, frühere vom Client zählen nie: %j (AC-6, AC-8)', (header, ip, isPublic) => {
    expect(clientIpFrom(header)).toEqual({ ip, isPublic })
  })

  it.each([
    '8.8.8.8, unknown',
    '8.8.8.8, 1.2.3.4:5678',
    '8.8.8.8, [2001:4860:4860::8888]:443',
    '8.8.8.8, ',
    '8.8.8.8,,',
    '8.8.8.8, fe80::1%eth0',
  ])('überspringt Einträge mit Port oder ohne gültige Adresse: %j (AC-6, AC-8)', (header) => {
    expect(clientIpFrom(header)).toEqual({ ip: '8.8.8.8', isPublic: true })
  })

  it.each([
    'garbage',
    'unknown, nonsense',
    ',,,',
    '256.1.1.1',
    '1.2.3',
    '1.2.3.4.5',
    '01.2.3.4',
    '1.2.3.4:80',
    '1::2::3',
    ':::',
    '1:2:3:4:5:6:7:8:9',
    '1:2:3:4:5:6:7:8::',
    '12345::1',
    'gggg::1',
    'dead:beef',
    '1.2.3.4::',
    '::1.2.3.4:5',
  ])('setzt ohne gültigen Eintrag die Ersatzadresse 0.0.0.0: %j (AC-6, AC-8)', (header) => {
    expect(clientIpFrom(header)).toEqual({ ip: '0.0.0.0', isPublic: false })
  })

  it.each([
    '0.0.0.0',
    '0.1.2.3',
    '127.0.0.1',
    '127.255.0.9',
    '10.1.2.3',
    '172.16.0.1',
    '172.31.255.255',
    '192.168.1.10',
    '169.254.10.20',
    '::',
    '::1',
    '0:0:0:0:0:0:0:1',
    'fc00::1',
    'fd12:3456::1',
    'FD12:3456::1',
    'fe80::1',
    'febf::1',
    '::ffff:127.0.0.1',
    '::ffff:10.0.0.1',
    '::ffff:192.168.0.1',
    '::ffff:169.254.0.1',
    '::ffff:0.0.0.0',
    '0:0:0:0:0:ffff:7f00:1',
  ])('erkennt Loopback, private und lokale Adressen als nicht öffentlich: %j (AC-6, AC-8)', (header) => {
    expect(clientIpFrom(header)).toEqual({ ip: header, isPublic: false })
  })

  it.each(['11.0.0.1', '126.255.255.255', '128.0.0.1', '172.15.255.255', '172.32.0.1', '192.169.0.1', '169.253.0.1', '1.0.0.0'])(
    'erkennt Adressen knapp neben den privaten Netzen als öffentlich: %j (AC-6, AC-8)',
    (header) => {
      expect(clientIpFrom(header)).toEqual({ ip: header, isPublic: true })
    },
  )
})

describe('registerFormError', () => {
  it.each([
    ['bot_check_rejected', 'AC-7', { message: 'Die Sicherheitsprüfung ist fehlgeschlagen. Bitte versuchen Sie es erneut.' }],
    ['bot_check_error', 'EC-3', { message: 'Die Registrierung ist fehlgeschlagen. Bitte versuchen Sie es erneut.' }],
    ['throttled', 'AC-8', { message: 'Zu viele Registrierungen. Bitte versuchen Sie es später erneut.' }],
    ['auth_rate_limited', 'AC-8', { message: 'Zu viele Registrierungen. Bitte versuchen Sie es später erneut.' }],
    ['failed', 'EC-3', { message: 'Die Registrierung ist fehlgeschlagen. Bitte versuchen Sie es erneut.' }],
  ] as const)('übersetzt %s in die Formularmeldung (%s)', (failure, _id, expected) => {
    expect(registerFormError(failure)).toStrictEqual(expected)
  })

  it('meldet eine schon registrierte Adresse mit Link zum Login (AC-3, EC-2)', () => {
    expect(registerFormError('duplicate')).toStrictEqual({
      message: 'Mit dieser E-Mail-Adresse ist bereits ein Konto registriert. Bitte melden Sie sich an.',
      loginLink: true,
    })
  })

  it('gibt nur bei einer schon registrierten Adresse den Link zum Login mit (AC-3)', () => {
    for (const failure of ['bot_check_rejected', 'bot_check_error', 'throttled', 'auth_rate_limited', 'failed'] as const) {
      expect(registerFormError(failure)).not.toHaveProperty('loginLink')
    }
  })
})

describe('loginFormError', () => {
  it('meldet eine abgelehnte Bot-Prüfung (AC-7)', () => {
    expect(loginFormError('bot_check_rejected')).toStrictEqual({
      message: 'Die Sicherheitsprüfung ist fehlgeschlagen. Bitte versuchen Sie es erneut.',
    })
  })

  it.each(['bot_check_error', 'failed'] as const)(
    'meldet bei %s, dass die Anmeldung fehlgeschlagen ist (EC-3 analog)',
    (failure) => {
      expect(loginFormError(failure)).toStrictEqual({
        message: 'Die Anmeldung ist fehlgeschlagen. Bitte versuchen Sie es erneut.',
      })
    },
  )

  it('meldet falsche Zugangsdaten mit demselben Text für unbekannte Adressen und falsche Passwörter (AC-5)', () => {
    expect(loginFormError('invalid_credentials')).toStrictEqual({
      message: 'E-Mail-Adresse oder Passwort ist falsch.',
    })
  })

  it.each([
    [14 * MINUTE + 30 * SECOND, 'Zu viele Anmeldeversuche. Bitte versuchen Sie es in 15 Minuten erneut.'],
    [61 * SECOND, 'Zu viele Anmeldeversuche. Bitte versuchen Sie es in 2 Minuten erneut.'],
    [30 * SECOND, 'Zu viele Anmeldeversuche. Bitte versuchen Sie es in 1 Minute erneut.'],
  ])('nennt bei einer Sperre die aufgerundete Restzeit (%i ms) (AC-6)', (left, message) => {
    expect(loginFormError('locked', { lockedUntil: after(left), now: NOW })).toStrictEqual({ message })
  })

  it('nennt bei einer Sperre ohne Zeitpunkt die volle Sperrzeit von 15 Minuten (AC-6)', () => {
    expect(loginFormError('locked')).toStrictEqual({
      message: 'Zu viele Anmeldeversuche. Bitte versuchen Sie es in 15 Minuten erneut.',
    })
  })

  it('nennt bei der eigenen Grenze von Supabase 5 Minuten (AC-6)', () => {
    expect(loginFormError('auth_rate_limited')).toStrictEqual({
      message: 'Zu viele Anmeldeversuche. Bitte versuchen Sie es in 5 Minuten erneut.',
    })
  })

  it('gibt beim Login nie einen Link zum Login mit (AC-5)', () => {
    for (const failure of ['bot_check_rejected', 'bot_check_error', 'locked', 'invalid_credentials', 'auth_rate_limited', 'failed'] as const) {
      expect(loginFormError(failure)).not.toHaveProperty('loginLink')
    }
  })
})
