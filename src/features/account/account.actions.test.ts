// @vitest-environment node
// The building blocks are replaced, so each test sees exactly which steps a request reaches and
// in what order (design.md → Registrieren, Anmelden). Time is fake for the 1-second rule.
import { login, register, type LoginState, type RegisterState } from './account.actions'
import { signInWithPassword, signUpTrainingProvider } from './auth.data'
import { beginLogin, beginRegistration, finishLogin, finishRegistration, isEmailRegistered } from './throttle.data'
import { verifyTurnstileToken } from './turnstile.integration'

const request = vi.hoisted(() => ({ forwardedFor: '8.8.8.8' as string | null }))

vi.mock('next/headers', () => ({
  headers: async () => new Headers(request.forwardedFor === null ? {} : { 'x-forwarded-for': request.forwardedFor }),
}))
vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`)
  }),
}))
vi.mock('./turnstile.integration', () => ({ verifyTurnstileToken: vi.fn() }))
vi.mock('./auth.data', () => ({ signUpTrainingProvider: vi.fn(), signInWithPassword: vi.fn() }))
vi.mock('./throttle.data', () => ({
  beginLogin: vi.fn(),
  finishLogin: vi.fn(),
  beginRegistration: vi.fn(),
  finishRegistration: vi.fn(),
  isEmailRegistered: vi.fn(),
}))

const TEXT = {
  botCheckFailed: 'Die Sicherheitsprüfung ist fehlgeschlagen. Bitte versuchen Sie es erneut.',
  registrationFailed: 'Die Registrierung ist fehlgeschlagen. Bitte versuchen Sie es erneut.',
  tooManyRegistrations: 'Zu viele Registrierungen. Bitte versuchen Sie es später erneut.',
  duplicate: 'Mit dieser E-Mail-Adresse ist bereits ein Konto registriert. Bitte melden Sie sich an.',
  invalidCredentials: 'E-Mail-Adresse oder Passwort ist falsch.',
  loginFailed: 'Die Anmeldung ist fehlgeschlagen. Bitte versuchen Sie es erneut.',
}

const validRegistration = {
  trainingProviderName: '  Akademie Nord  ',
  email: '  Verwalter@Akademie-Nord.DE ',
  password: ' Geheim 123 ',
  passwordConfirmation: ' Geheim 123 ',
  turnstileToken: 'token-1',
}

const validLogin = { email: ' Verwalter@Akademie-Nord.DE', password: ' Geheim 123 ', turnstileToken: 'token-1' }

beforeEach(() => {
  vi.useFakeTimers()
  request.forwardedFor = '8.8.8.8'
  vi.mocked(verifyTurnstileToken).mockResolvedValue('passed')
  vi.mocked(beginRegistration).mockResolvedValue({ status: 'allowed', attemptId: 11 })
  vi.mocked(finishRegistration).mockResolvedValue(true)
  vi.mocked(beginLogin).mockResolvedValue({ status: 'allowed', attemptId: 22 })
  vi.mocked(finishLogin).mockResolvedValue(true)
  vi.mocked(signUpTrainingProvider).mockResolvedValue({ status: 'success' })
  vi.mocked(signInWithPassword).mockResolvedValue({ status: 'success' })
  vi.mocked(isEmailRegistered).mockResolvedValue(false)
})

afterEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
})

/** Runs the action with fake time and returns its answer plus the time it took. */
async function timed<State>(action: () => Promise<State>) {
  const startedAt = Date.now()
  let settled: { state?: State; error?: unknown; at?: number } = {}
  void action().then(
    (state) => (settled = { state, at: Date.now() - startedAt }),
    (error) => (settled = { error, at: Date.now() - startedAt })
  )
  await vi.advanceTimersByTimeAsync(5_000)
  return settled
}

async function registerWith(input: unknown) {
  const { state, error } = await timed<RegisterState>(() => register(input))
  if (error) throw error
  return state!
}

async function loginWith(input: unknown) {
  const { state, error, at } = await timed<LoginState>(() => login(input))
  if (error) throw error
  return { state: state!, at: at! }
}

describe('register', () => {
  it('prüft, bremst, registriert mit normalisierter Adresse, unverändertem Passwort und gekürztem Namen und leitet weiter (AC-1)', async () => {
    await expect(register({ ...validRegistration, licenseQuota: 99, role: 'owner' })).rejects.toThrow(
      'NEXT_REDIRECT /licenses'
    )

    expect(verifyTurnstileToken).toHaveBeenCalledWith('token-1', '8.8.8.8')
    expect(beginRegistration).toHaveBeenCalledWith('8.8.8.8')
    expect(signUpTrainingProvider).toHaveBeenCalledWith({
      email: 'verwalter@akademie-nord.de',
      password: ' Geheim 123 ',
      trainingProviderName: 'Akademie Nord',
    })
    expect(finishRegistration).toHaveBeenCalledWith(11, 'success')
    const order = [verifyTurnstileToken, beginRegistration, signUpTrainingProvider, finishRegistration].map(
      (fn) => vi.mocked(fn).mock.invocationCallOrder[0]
    )
    expect(order).toEqual([...order].sort((a, b) => a - b))
  })

  it('liefert Feldfehler und erreicht weder Bot-Prüfung noch Bremse noch Supabase (AC-2)', async () => {
    const state = await registerWith({
      ...validRegistration,
      trainingProviderName: ' A ',
      email: 'keine-adresse',
      password: 'kurz',
      passwordConfirmation: 'anders',
    })

    expect(state).toEqual({
      fieldErrors: {
        trainingProviderName: 'Der Name muss mindestens 2 Zeichen lang sein.',
        email: 'Bitte geben Sie eine gültige E-Mail-Adresse ein.',
        password: 'Das Passwort muss mindestens 8 Zeichen lang sein.',
        passwordConfirmation: 'Die Passwörter stimmen nicht überein.',
      },
    })
    expect(verifyTurnstileToken).not.toHaveBeenCalled()
    expect(beginRegistration).not.toHaveBeenCalled()
    expect(signUpTrainingProvider).not.toHaveBeenCalled()
  })

  it.each([
    ['ohne Token', { ...validRegistration, turnstileToken: '' }],
    ['mit zu langem Token', { ...validRegistration, turnstileToken: 'x'.repeat(2_049) }],
  ])('lehnt eine Anfrage %s ab, ohne etwas zu zählen (AC-7)', async (_case, input) => {
    expect(await registerWith(input)).toEqual({ formError: { message: TEXT.botCheckFailed } })
    expect(verifyTurnstileToken).not.toHaveBeenCalled()
    expect(beginRegistration).not.toHaveBeenCalled()
  })

  it('lehnt Eingaben ab, die kein Objekt sind', async () => {
    expect(await registerWith('trainingProviderName=X')).toEqual({ formError: { message: TEXT.registrationFailed } })
    expect(await registerWith(null)).toEqual({ formError: { message: TEXT.registrationFailed } })
    expect(signUpTrainingProvider).not.toHaveBeenCalled()
  })

  it.each([
    ['abgelehnt', 'rejected', TEXT.botCheckFailed],
    ['nicht durchführbar', 'error', TEXT.registrationFailed],
  ] as const)('stoppt bei einer Bot-Prüfung „%s“ vor Bremse und Supabase (AC-7, EC-3)', async (_case, verdict, message) => {
    vi.mocked(verifyTurnstileToken).mockResolvedValue(verdict)

    expect(await registerWith(validRegistration)).toEqual({ formError: { message } })
    expect(beginRegistration).not.toHaveBeenCalled()
    expect(signUpTrainingProvider).not.toHaveBeenCalled()
  })

  it.each([
    ['gesperrt', { status: 'locked' as const }, TEXT.tooManyRegistrations],
    ['ein Datenbankfehler', { status: 'error' as const }, TEXT.registrationFailed],
  ])('legt nichts an, wenn die Bremse „%s“ meldet (AC-8)', async (_case, brake, message) => {
    vi.mocked(beginRegistration).mockResolvedValue(brake)

    expect(await registerWith(validRegistration)).toEqual({ formError: { message } })
    expect(signUpTrainingProvider).not.toHaveBeenCalled()
    expect(finishRegistration).not.toHaveBeenCalled()
  })

  it('meldet eine schon registrierte Adresse mit Link zum Login und zählt sie als duplicate (AC-3, AC-8)', async () => {
    vi.mocked(signUpTrainingProvider).mockResolvedValue({ status: 'duplicate' })

    expect(await registerWith(validRegistration)).toEqual({
      formError: { message: TEXT.duplicate, loginLink: true },
    })
    expect(finishRegistration).toHaveBeenCalledWith(11, 'duplicate')
  })

  it('meldet Supabases eigene Grenze wie die Registrierungsbremse und zählt sie als error (AC-8)', async () => {
    vi.mocked(signUpTrainingProvider).mockResolvedValue({ status: 'auth_rate_limited' })

    expect(await registerWith(validRegistration)).toEqual({ formError: { message: TEXT.tooManyRegistrations } })
    expect(finishRegistration).toHaveBeenCalledWith(11, 'error')
  })

  it('meldet ein von Supabase abgelehntes Passwort am Passwortfeld (Sicherheitsnetz)', async () => {
    vi.mocked(signUpTrainingProvider).mockResolvedValue({ status: 'password_rejected' })

    expect(await registerWith(validRegistration)).toEqual({
      fieldErrors: { password: 'Das Passwort muss mindestens 8 Zeichen lang sein.' },
    })
    expect(finishRegistration).toHaveBeenCalledWith(11, 'error')
  })

  it('zeigt dem Verlierer zweier gleichzeitiger Registrierungen die Meldung aus AC-3 (EC-2)', async () => {
    vi.mocked(signUpTrainingProvider).mockResolvedValue({ status: 'failed' })
    vi.mocked(isEmailRegistered).mockResolvedValue(true)

    expect(await registerWith(validRegistration)).toEqual({
      formError: { message: TEXT.duplicate, loginLink: true },
    })
    expect(isEmailRegistered).toHaveBeenCalledWith('verwalter@akademie-nord.de')
    expect(finishRegistration).toHaveBeenCalledWith(11, 'duplicate')
  })

  it.each([
    ['nicht registriert', false],
    ['die Nachfrage scheitert', null],
  ])('meldet einen sonstigen Fehler als EC-3, wenn die Adresse %s ist', async (_case, registered) => {
    vi.mocked(signUpTrainingProvider).mockResolvedValue({ status: 'failed' })
    vi.mocked(isEmailRegistered).mockResolvedValue(registered)

    expect(await registerWith(validRegistration)).toEqual({ formError: { message: TEXT.registrationFailed } })
    expect(finishRegistration).toHaveBeenCalledWith(11, 'error')
  })

  it.each([
    ['den letzten gültigen Eintrag', '203.0.113.1, 8.8.4.4', '8.8.4.4', '8.8.4.4'],
    ['eine private Adresse nicht an Cloudflare', '10.0.0.5', '10.0.0.5', undefined],
    ['ohne Kopf die Ersatzadresse', null, '0.0.0.0', undefined],
  ])('nimmt aus X-Forwarded-For %s (Bremse und Bot-Prüfung)', async (_case, header, brakeIp, cloudflareIp) => {
    request.forwardedFor = header

    await expect(register(validRegistration)).rejects.toThrow('NEXT_REDIRECT')
    expect(beginRegistration).toHaveBeenCalledWith(brakeIp)
    expect(verifyTurnstileToken).toHaveBeenCalledWith('token-1', cloudflareIp)
  })
})

describe('login', () => {
  it('prüft, bremst, prüft das Passwort, schließt den Versuch als Erfolg ab und leitet sofort weiter (AC-4, EC-7)', async () => {
    const { error, at } = await timed(() => login(validLogin))

    expect(String(error)).toContain('NEXT_REDIRECT /licenses')
    expect(at).toBe(0)
    expect(verifyTurnstileToken).toHaveBeenCalledWith('token-1', '8.8.8.8')
    expect(beginLogin).toHaveBeenCalledWith('verwalter@akademie-nord.de', '8.8.8.8')
    expect(signInWithPassword).toHaveBeenCalledWith('verwalter@akademie-nord.de', ' Geheim 123 ')
    expect(finishLogin).toHaveBeenCalledWith(22, 'success')
  })

  it.each([
    ['über 72 Zeichen', 'a'.repeat(73)],
    ['über 72 Bytes durch Umlaute', 'ä'.repeat(37)],
    ['über 1.000 Zeichen', 'a'.repeat(5_000)],
  ])('antwortet bei einem Passwort %s wie bei falschem Passwort, ohne Bot-Prüfung, Bremse und Zählung (AC-5)', async (_case, password) => {
    for (const input of [{ ...validLogin, password }, { ...validLogin, password, turnstileToken: '' }]) {
      const { state, at } = await loginWith(input)
      expect(state).toEqual({ formError: { message: TEXT.invalidCredentials } })
      expect(at).toBeGreaterThanOrEqual(1_000)
    }
    expect(verifyTurnstileToken).not.toHaveBeenCalled()
    expect(beginLogin).not.toHaveBeenCalled()
    expect(signInWithPassword).not.toHaveBeenCalled()
  })

  it('liefert Feldfehler, ohne etwas zu zählen (AC-2, EC-4)', async () => {
    const { state } = await loginWith({ email: ' ', password: '', turnstileToken: 'token-1' })

    expect(state).toEqual({
      fieldErrors: {
        email: 'Bitte geben Sie Ihre E-Mail-Adresse ein.',
        password: 'Bitte geben Sie Ihr Passwort ein.',
      },
    })
    expect(verifyTurnstileToken).not.toHaveBeenCalled()
    expect(beginLogin).not.toHaveBeenCalled()
  })

  it('lehnt eine Anfrage ohne Token ab, ohne etwas zu zählen (AC-7)', async () => {
    const { state } = await loginWith({ ...validLogin, turnstileToken: '' })

    expect(state).toEqual({ formError: { message: TEXT.botCheckFailed } })
    expect(verifyTurnstileToken).not.toHaveBeenCalled()
    expect(beginLogin).not.toHaveBeenCalled()
  })

  it.each([
    ['abgelehnt', 'rejected', TEXT.botCheckFailed],
    ['nicht durchführbar', 'error', TEXT.loginFailed],
  ] as const)('stoppt bei einer Bot-Prüfung „%s“ vor der Bremse, damit niemand fremde Adressen sperren kann (AC-7)', async (_case, verdict, message) => {
    vi.mocked(verifyTurnstileToken).mockResolvedValue(verdict)

    expect((await loginWith(validLogin)).state).toEqual({ formError: { message } })
    expect(beginLogin).not.toHaveBeenCalled()
    expect(signInWithPassword).not.toHaveBeenCalled()
  })

  it('nennt bei einer Sperre die aufgerundete Restzeit und prüft kein Passwort, auch kein richtiges (AC-6)', async () => {
    vi.mocked(beginLogin).mockResolvedValue({
      status: 'locked',
      lockedUntil: new Date(Date.now() + 14 * 60_000 + 30_000),
    })

    expect((await loginWith(validLogin)).state).toEqual({
      formError: { message: 'Zu viele Anmeldeversuche. Bitte versuchen Sie es in 15 Minuten erneut.' },
    })
    expect(signInWithPassword).not.toHaveBeenCalled()
    expect(finishLogin).not.toHaveBeenCalled()
  })

  it('macht aus einem Fehler der Bremse einen Fehler, nie einen Login (AC-6)', async () => {
    vi.mocked(beginLogin).mockResolvedValue({ status: 'error' })

    expect((await loginWith(validLogin)).state).toEqual({ formError: { message: TEXT.loginFailed } })
    expect(signInWithPassword).not.toHaveBeenCalled()
  })

  it.each([
    ['falsche Zugangsdaten', 'invalid_credentials', 'failure', TEXT.invalidCredentials],
    [
      'Supabases eigene Grenze',
      'auth_rate_limited',
      'error',
      'Zu viele Anmeldeversuche. Bitte versuchen Sie es in 5 Minuten erneut.',
    ],
    ['einen sonstigen Fehler', 'failed', 'error', TEXT.loginFailed],
  ] as const)('schließt %s mit dem richtigen Ergebnis ab (AC-5, AC-6)', async (_case, status, outcome, message) => {
    vi.mocked(signInWithPassword).mockResolvedValue({ status })

    expect((await loginWith(validLogin)).state).toEqual({ formError: { message } })
    expect(finishLogin).toHaveBeenCalledWith(22, outcome)
  })

  it.each<[string, () => unknown, unknown?]>([
    ['falschem Passwort', () => vi.mocked(signInWithPassword).mockResolvedValue({ status: 'invalid_credentials' })],
    ['Sperre', () => vi.mocked(beginLogin).mockResolvedValue({ status: 'locked', lockedUntil: new Date(Date.now() + 60_000) })],
    ['Feldfehler', () => undefined, { email: '', password: '', turnstileToken: 'x' }],
    ['abgelehnter Bot-Prüfung', () => vi.mocked(verifyTurnstileToken).mockResolvedValue('rejected')],
  ])('antwortet bei %s frühestens nach 1 Sekunde (AC-5)', async (_case, arrange, input = validLogin) => {
    arrange()

    const { at } = await loginWith(input)
    expect(at).toBeGreaterThanOrEqual(1_000)
    expect(at).toBeLessThan(1_100)
  })

  it('wartet nicht zusätzlich, wenn die Prüfung schon länger als 1 Sekunde gedauert hat (AC-5)', async () => {
    vi.mocked(signInWithPassword).mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({ status: 'invalid_credentials' }), 1_500))
    )

    expect((await loginWith(validLogin)).at).toBe(1_500)
  })

  it('schickt eine private IP nicht an Cloudflare, bremst aber mit ihr', async () => {
    request.forwardedFor = '127.0.0.1'
    vi.mocked(signInWithPassword).mockResolvedValue({ status: 'invalid_credentials' })

    await loginWith(validLogin)
    expect(verifyTurnstileToken).toHaveBeenCalledWith('token-1', undefined)
    expect(beginLogin).toHaveBeenCalledWith('verwalter@akademie-nord.de', '127.0.0.1')
  })
})
