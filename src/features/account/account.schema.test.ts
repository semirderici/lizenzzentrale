// @vitest-environment node
import type { ZodType } from 'zod'
import { exceedsPasswordLimit, loginSchema, registerSchema } from './account.schema'

// The literal German texts, so a typo in MESSAGES fails here (design.md → "Eingaberegeln").
const NAME_REQUIRED = 'Bitte geben Sie den Namen Ihres Bildungsträgers ein.'
const NAME_TOO_SHORT = 'Der Name muss mindestens 2 Zeichen lang sein.'
const NAME_TOO_LONG = 'Der Name darf höchstens 100 Zeichen lang sein.'
const EMAIL_REQUIRED = 'Bitte geben Sie Ihre E-Mail-Adresse ein.'
const EMAIL_INVALID = 'Bitte geben Sie eine gültige E-Mail-Adresse ein.'
const PASSWORD_TOO_SHORT = 'Das Passwort muss mindestens 8 Zeichen lang sein.'
const PASSWORD_TOO_LONG = 'Das Passwort darf höchstens 72 Zeichen lang sein.'
const PASSWORD_TOO_MANY_BYTES =
  'Das Passwort ist zu lang, weil Umlaute und andere besondere Zeichen mehrfach zählen. Bitte kürzen Sie es.'
const CONFIRMATION_REQUIRED = 'Bitte wiederholen Sie das Passwort.'
const PASSWORD_MISMATCH = 'Die Passwörter stimmen nicht überein.'
const LOGIN_PASSWORD_REQUIRED = 'Bitte geben Sie Ihr Passwort ein.'
const BOT_CHECK_FAILED = 'Die Sicherheitsprüfung ist fehlgeschlagen. Bitte versuchen Sie es erneut.'

const UMLAUT = 'ä' // ä: 1 character, 2 UTF-8 bytes
const EMOJI = '\u{1F393}' // 🎓: 1 character, 2 UTF-16 units, 4 UTF-8 bytes

const VALID_REGISTER = {
  trainingProviderName: 'Weiterbildungsinstitut Nord',
  email: 'verwalter@example.de',
  password: 'sicheres-passwort',
  passwordConfirmation: 'sicheres-passwort',
  turnstileToken: 'turnstile-token',
}

const VALID_LOGIN = {
  email: 'verwalter@example.de',
  password: 'sicheres-passwort',
  turnstileToken: 'turnstile-token',
}

/** The messages per field; an empty object means the input passed. */
function messagesOf(schema: ZodType, input: unknown): Record<string, string[]> {
  const result = schema.safeParse(input)
  if (result.success) return {}
  const messages: Record<string, string[]> = {}
  for (const issue of result.error.issues) {
    const field = String(issue.path[0] ?? '')
    messages[field] = [...(messages[field] ?? []), issue.message]
  }
  return messages
}

const register = (overrides: Record<string, unknown>) =>
  messagesOf(registerSchema, { ...VALID_REGISTER, ...overrides })
const login = (overrides: Record<string, unknown>) =>
  messagesOf(loginSchema, { ...VALID_LOGIN, ...overrides })
const withPassword = (password: unknown) =>
  register({ password, passwordConfirmation: password })

/** A realistic address of exactly `length` characters (64-character local part, 63-character labels). */
function emailOfLength(length: number): string {
  const lastLabel = length - (64 + 1 + 63 + 1 + 63 + 1 + 3)
  return `${'x'.repeat(64)}@${'a'.repeat(63)}.${'b'.repeat(63)}.${'c'.repeat(lastLabel)}.de`
}

describe('registerSchema', () => {
  it('nimmt eine gültige Registrierung an und gibt die Werte normalisiert zurück (AC-1, EC-4)', () => {
    const values = registerSchema.parse({
      ...VALID_REGISTER,
      trainingProviderName: '  Bildungswerk Süd e. V.  ',
      email: '  Verwalter@Example.DE ',
    })
    expect(values).toEqual({
      trainingProviderName: 'Bildungswerk Süd e. V.',
      email: 'verwalter@example.de',
      password: 'sicheres-passwort',
      passwordConfirmation: 'sicheres-passwort',
      turnstileToken: 'turnstile-token',
    })
  })

  it('ignoriert mitgeschickte Zusatzfelder wie ein eigenes Kontingent (AC-1)', () => {
    const values = registerSchema.parse({ ...VALID_REGISTER, quota: 999, role: 'owner' })
    expect(values).not.toHaveProperty('quota')
    expect(values).not.toHaveProperty('role')
  })

  it('meldet bei einem leeren Formular an jedem Feld genau eine Meldung (AC-2, AC-7)', () => {
    expect(
      register({
        trainingProviderName: '',
        email: '',
        password: '',
        passwordConfirmation: '',
        turnstileToken: '',
      }),
    ).toEqual({
      trainingProviderName: [NAME_REQUIRED],
      email: [EMAIL_REQUIRED],
      password: [PASSWORD_TOO_SHORT],
      passwordConfirmation: [CONFIRMATION_REQUIRED],
      turnstileToken: [BOT_CHECK_FAILED],
    })
  })

  it('meldet fehlende Felder einer Anfrage am Formular vorbei mit denselben Meldungen (AC-2, AC-7)', () => {
    expect(messagesOf(registerSchema, {})).toEqual({
      trainingProviderName: [NAME_REQUIRED],
      email: [EMAIL_REQUIRED],
      password: [PASSWORD_TOO_SHORT],
      passwordConfirmation: [CONFIRMATION_REQUIRED],
      turnstileToken: [BOT_CHECK_FAILED],
    })
    expect(registerSchema.safeParse(null).success).toBe(false)
  })

  describe('Name des Bildungsträgers', () => {
    it('kürzt den Trägernamen am Rand und gibt ihn gekürzt zurück (AC-2)', () => {
      const values = registerSchema.parse({
        ...VALID_REGISTER,
        trainingProviderName: ' \t Institut <b>&</b> Co \n',
      })
      expect(values.trainingProviderName).toBe('Institut <b>&</b> Co')
    })

    it.each(['', '   ', '\t\n '])(
      'meldet einen Trägernamen, der nach dem Kürzen leer ist: %j (AC-2)',
      (trainingProviderName) => {
        expect(register({ trainingProviderName })).toEqual({ trainingProviderName: [NAME_REQUIRED] })
      },
    )

    it.each(['A', '  A  ', EMOJI, UMLAUT])(
      'meldet einen Trägernamen unter 2 Zeichen, ein Emoji zählt als 1: %j (AC-2)',
      (trainingProviderName) => {
        expect(register({ trainingProviderName })).toEqual({ trainingProviderName: [NAME_TOO_SHORT] })
      },
    )

    it('kürzt den Trägernamen und zählt wie char_length: 2 und 100 Zeichen mit Umlauten und Emoji gelten (AC-2)', () => {
      for (const trainingProviderName of [
        'AB',
        `${UMLAUT}${UMLAUT}`,
        `A${EMOJI}`,
        'a'.repeat(100),
        `  ${UMLAUT.repeat(99)}${EMOJI}  `, // 100 code points, 101 UTF-16 units
      ]) {
        expect(register({ trainingProviderName })).toEqual({})
      }
    })

    it.each([
      ['101 Buchstaben', 'a'.repeat(101)],
      ['101 Umlaute', UMLAUT.repeat(101)],
      ['100 Umlaute und ein Emoji', `${UMLAUT.repeat(100)}${EMOJI}`],
    ])('meldet einen Trägernamen über 100 Zeichen: %s (AC-2)', (_, trainingProviderName) => {
      expect(register({ trainingProviderName })).toEqual({ trainingProviderName: [NAME_TOO_LONG] })
    })
  })

  describe('E-Mail-Adresse', () => {
    it('behandelt Großbuchstaben und Leerzeichen am Rand wie die kleingeschriebene Adresse (EC-4)', () => {
      expect(registerSchema.parse({ ...VALID_REGISTER, email: ' \tMAX.Mustermann@Example.DE  ' }).email).toBe(
        'max.mustermann@example.de',
      )
    })

    it.each(['', '   '])('meldet eine leere E-Mail-Adresse: %j (AC-2)', (email) => {
      expect(register({ email })).toEqual({ email: [EMAIL_REQUIRED] })
    })

    it.each([
      'verwalter',
      'verwalter@',
      '@example.de',
      'verwalter@example',
      'ver walter@example.de',
      'ver..walter@example.de',
      'verwalter@@example.de',
    ])('meldet eine ungültige E-Mail-Adresse: %j (AC-2)', (email) => {
      expect(register({ email })).toEqual({ email: [EMAIL_INVALID] })
    })

    it('nimmt eine Adresse mit 254 Zeichen an und meldet 255 Zeichen als ungültig (AC-2)', () => {
      expect(emailOfLength(254)).toHaveLength(254)
      expect(register({ email: emailOfLength(254) })).toEqual({})
      expect(register({ email: emailOfLength(255) })).toEqual({ email: [EMAIL_INVALID] })
    })

    it('zählt die 254 Zeichen nach dem Entfernen der Leerzeichen am Rand (EC-4)', () => {
      expect(register({ email: `  ${emailOfLength(254).toUpperCase()}  ` })).toEqual({})
    })
  })

  describe('Passwort', () => {
    it('nimmt 8 und 72 Zeichen ohne Pflicht zu Zeichenarten an (AC-2)', () => {
      expect(withPassword('aaaaaaaa')).toEqual({})
      expect(withPassword('a'.repeat(72))).toEqual({})
    })

    it.each([
      ['7 Zeichen', 'abcdefg'],
      ['7 Emoji (14 UTF-16-Einheiten)', EMOJI.repeat(7)],
    ])('meldet ein Passwort unter 8 Zeichen: %s (AC-2)', (_, password) => {
      expect(withPassword(password)).toEqual({ password: [PASSWORD_TOO_SHORT] })
    })

    it('meldet ein leeres Passwort als zu kurz (AC-2)', () => {
      expect(register({ password: '' })).toEqual({
        password: [PASSWORD_TOO_SHORT],
        passwordConfirmation: [PASSWORD_MISMATCH],
      })
    })

    it('zählt Passwortzeichen als Code Points: 8 Emoji gelten (AC-2)', () => {
      expect(withPassword(EMOJI.repeat(8))).toEqual({})
    })

    it.each([
      ['73 Buchstaben', 'a'.repeat(73)],
      ['73 Umlaute', UMLAUT.repeat(73)],
    ])('meldet ein Passwort über 72 Zeichen, vor der Byte-Grenze: %s (AC-2)', (_, password) => {
      expect(withPassword(password)).toEqual({ password: [PASSWORD_TOO_LONG] })
    })

    it('nimmt genau 72 Bytes mit Umlauten und Emoji an (AC-2)', () => {
      expect(withPassword(UMLAUT.repeat(36))).toEqual({})
      expect(withPassword(`${'a'.repeat(70)}${UMLAUT}`)).toEqual({})
      expect(withPassword(EMOJI.repeat(18))).toEqual({})
    })

    it.each([
      ['36 Umlaute und ein Buchstabe', `${UMLAUT.repeat(36)}a`],
      ['72 Zeichen mit einem Umlaut', `${'a'.repeat(71)}${UMLAUT}`],
      ['18 Emoji und ein Buchstabe', `${EMOJI.repeat(18)}a`],
    ])('meldet ein Passwort bis 72 Zeichen, aber über 72 Bytes: %s (AC-2)', (_, password) => {
      expect(withPassword(password)).toEqual({ password: [PASSWORD_TOO_MANY_BYTES] })
    })

    it('verändert und kürzt das Passwort nie (EC-4)', () => {
      const password = '  Geheim Passwort  '
      expect(registerSchema.parse({ ...VALID_REGISTER, password, passwordConfirmation: password }).password).toBe(
        password,
      )
    })
  })

  describe('Passwort wiederholen', () => {
    it.each([[''], [undefined]])('meldet eine fehlende Wiederholung: %j (AC-2)', (passwordConfirmation) => {
      expect(register({ passwordConfirmation })).toEqual({ passwordConfirmation: [CONFIRMATION_REQUIRED] })
    })

    it('meldet eine abweichende Wiederholung am Wiederholungsfeld (AC-2)', () => {
      const result = registerSchema.safeParse({ ...VALID_REGISTER, passwordConfirmation: 'anderes-passwort' })
      expect(result.success).toBe(false)
      expect(result.error?.issues.map((issue) => [issue.path, issue.message])).toEqual([
        [['passwordConfirmation'], PASSWORD_MISMATCH],
      ])
    })

    it('vergleicht genau, ohne Leerzeichen zu entfernen (AC-2, EC-4)', () => {
      expect(register({ passwordConfirmation: `${VALID_REGISTER.password} ` })).toEqual({
        passwordConfirmation: [PASSWORD_MISMATCH],
      })
    })

    it('zeigt die Abweichung zusammen mit den Fehlern anderer Felder (AC-2)', () => {
      expect(
        register({ trainingProviderName: '', email: 'falsch', password: 'kurz', passwordConfirmation: 'anders' }),
      ).toEqual({
        trainingProviderName: [NAME_REQUIRED],
        email: [EMAIL_INVALID],
        password: [PASSWORD_TOO_SHORT],
        passwordConfirmation: [PASSWORD_MISMATCH],
      })
    })

    it('meldet bei fehlendem Passwort keine Abweichung (AC-2)', () => {
      expect(register({ password: undefined, passwordConfirmation: 'irgendwas' })).toEqual({
        password: [PASSWORD_TOO_SHORT],
      })
    })
  })

  describe('Obergrenze von 1.000 Zeichen vor allen anderen Regeln', () => {
    it('meldet beim Trägernamen über 1.000 Zeichen die Obergrenze, auch wenn das Kürzen ihn retten würde (AC-2)', () => {
      expect(register({ trainingProviderName: `${' '.repeat(999)}AB` })).toEqual({
        trainingProviderName: [NAME_TOO_LONG],
      })
      expect(registerSchema.parse({ ...VALID_REGISTER, trainingProviderName: `${' '.repeat(998)}AB` })
        .trainingProviderName).toBe('AB')
    })

    it('zählt die 1.000 Zeichen als Code Points (AC-2)', () => {
      // 990 spaces + 10 emoji = 1,000 code points but 1,010 UTF-16 units
      expect(register({ trainingProviderName: `${' '.repeat(990)}${EMOJI.repeat(10)}` })).toEqual({})
      expect(register({ trainingProviderName: `${' '.repeat(991)}${EMOJI.repeat(10)}` })).toEqual({
        trainingProviderName: [NAME_TOO_LONG],
      })
    })

    it('meldet bei der E-Mail-Adresse über 1.000 Zeichen „ungültig“ (AC-2)', () => {
      const address = 'a@example.de'
      expect(register({ email: `${' '.repeat(1000 - address.length)}${address}` })).toEqual({})
      expect(register({ email: `${' '.repeat(1001 - address.length)}${address}` })).toEqual({
        email: [EMAIL_INVALID],
      })
    })

    it('meldet beim Passwort und bei der Wiederholung über 1.000 Zeichen die Obergrenze (AC-2)', () => {
      expect(withPassword('x'.repeat(1000))).toEqual({ password: [PASSWORD_TOO_LONG] })
      expect(withPassword('x'.repeat(1001))).toEqual({
        password: [PASSWORD_TOO_LONG],
        passwordConfirmation: [PASSWORD_TOO_LONG],
      })
    })
  })

  describe('Turnstile-Token', () => {
    it.each([
      ['fehlt', undefined],
      ['leer', ''],
      ['2.049 Zeichen', 't'.repeat(2049)],
      ['keine Zeichenkette', 42],
    ])('meldet die Bot-Prüfung als fehlgeschlagen, wenn das Token %s (AC-7)', (_, turnstileToken) => {
      expect(register({ turnstileToken })).toEqual({ turnstileToken: [BOT_CHECK_FAILED] })
    })

    it('nimmt ein Token mit 2.048 Zeichen an (AC-7)', () => {
      expect(register({ turnstileToken: 't'.repeat(2048) })).toEqual({})
    })
  })
})

describe('loginSchema', () => {
  it('nimmt eine gültige Anmeldung an, normalisiert die Adresse und lässt das Passwort unverändert (AC-4, EC-4)', () => {
    expect(
      loginSchema.parse({ email: '  Verwalter@EXAMPLE.de ', password: ' Geheim ', turnstileToken: 'tok' }),
    ).toEqual({ email: 'verwalter@example.de', password: ' Geheim ', turnstileToken: 'tok' })
  })

  it('meldet bei einem leeren Formular an jedem Feld genau eine Meldung (AC-5, AC-7)', () => {
    expect(login({ email: '', password: '', turnstileToken: '' })).toEqual({
      email: [EMAIL_REQUIRED],
      password: [LOGIN_PASSWORD_REQUIRED],
      turnstileToken: [BOT_CHECK_FAILED],
    })
    expect(messagesOf(loginSchema, {})).toEqual({
      email: [EMAIL_REQUIRED],
      password: [LOGIN_PASSWORD_REQUIRED],
      turnstileToken: [BOT_CHECK_FAILED],
    })
  })

  it.each(['verwalter', 'verwalter@example', emailOfLength(255), `${' '.repeat(1001)}a@b.de`])(
    'meldet eine ungültige E-Mail-Adresse wie bei der Registrierung (AC-2, EC-4)',
    (email) => {
      expect(login({ email })).toEqual({ email: [EMAIL_INVALID] })
    },
  )

  it('zählt ein Passwort nur aus Leerzeichen als eingegeben (EC-4)', () => {
    expect(login({ password: '   ' })).toEqual({})
  })

  it.each([
    ['73 Buchstaben', 'a'.repeat(73)],
    ['37 Umlaute', UMLAUT.repeat(37)],
    ['5.000 Zeichen', 'x'.repeat(5000)],
    ['7 Zeichen', 'abcdefg'],
  ])('gibt für ein Login-Passwort mit %s keinen Feldfehler (AC-5)', (_, password) => {
    expect(login({ password })).toEqual({})
  })

  it.each([
    ['fehlt', undefined],
    ['leer', ''],
    ['2.049 Zeichen', 't'.repeat(2049)],
  ])('meldet die Bot-Prüfung als fehlgeschlagen, wenn das Token %s (AC-7)', (_, turnstileToken) => {
    expect(login({ turnstileToken })).toEqual({ turnstileToken: [BOT_CHECK_FAILED] })
  })

  it('nimmt ein Token mit 2.048 Zeichen an (AC-7)', () => {
    expect(login({ turnstileToken: 't'.repeat(2048) })).toEqual({})
  })
})

describe('exceedsPasswordLimit', () => {
  it.each([
    ['leer', ''],
    ['72 Buchstaben', 'a'.repeat(72)],
    ['36 Umlaute = 72 Bytes', UMLAUT.repeat(36)],
    ['18 Emoji = 72 Bytes', EMOJI.repeat(18)],
  ])('lässt ein Passwort mit %s durch (AC-5)', (_, password) => {
    expect(exceedsPasswordLimit(password)).toBe(false)
  })

  it.each([
    ['73 Buchstaben', 'a'.repeat(73)],
    ['36 Umlaute und ein Buchstabe = 73 Bytes', `${UMLAUT.repeat(36)}a`],
    ['72 Zeichen mit einem Umlaut = 73 Bytes', `${'a'.repeat(71)}${UMLAUT}`],
    ['18 Emoji und ein Buchstabe = 73 Bytes', `${EMOJI.repeat(18)}a`],
    ['100.000 Zeichen', 'x'.repeat(100_000)],
  ])('erkennt ein Passwort mit %s als zu lang (AC-5)', (_, password) => {
    expect(exceedsPasswordLimit(password)).toBe(true)
  })
})
