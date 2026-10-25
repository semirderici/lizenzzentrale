// @vitest-environment node
// Database tests for supabase/migrations/20261021120100_proj1_login_throttle.sql, called the way
// the app calls them: through the admin client. Every test uses its own random addresses and
// IPs, so runs never count each other's attempts.
import { randomBytes } from 'node:crypto'
import {
  createAdminTestClient,
  createAnonTestClient,
  createTestAccount,
  createUserTestClient,
  deleteTestAccounts,
  uniqueEmail,
} from '@/test/supabase'

const TIMEOUT = 120_000
const FIFTEEN_MINUTES = 15 * 60 * 1000
const CLOCK_TOLERANCE = 60 * 1000
const PERMISSION_DENIED = '42501'

type BeginResult =
  | { status: 'allowed'; attempt_id: number }
  | { status: 'locked'; locked_until?: string }

const admin = createAdminTestClient()

/** A random address from the IPv6 documentation range 2001:db8::/32. */
function uniqueIp() {
  const groups = randomBytes(12).toString('hex').match(/.{4}/g)!
  return `2001:db8:${groups.join(':')}`
}

async function rpc<T>(fn: string, args: Record<string, unknown>) {
  const { data, error } = await admin.rpc(fn, args)
  if (error) throw error
  return data as T
}

const beginLogin = (email: string, ip: string) =>
  rpc<BeginResult>('license_center_begin_login', { p_email: email, p_ip_address: ip })
const finishLogin = (attemptId: number, outcome: 'success' | 'failure' | 'error') =>
  rpc<null>('license_center_finish_login', { p_attempt_id: attemptId, p_outcome: outcome })
const beginRegistration = (ip: string) =>
  rpc<BeginResult>('license_center_begin_registration', { p_ip_address: ip })
const finishRegistration = (attemptId: number, outcome: 'success' | 'duplicate' | 'error') =>
  rpc<null>('license_center_finish_registration', { p_attempt_id: attemptId, p_outcome: outcome })

async function allowedLogin(email: string, ip: string) {
  const result = await beginLogin(email, ip)
  expect(result.status).toBe('allowed')
  return (result as { attempt_id: number }).attempt_id
}

async function loginAttempt(email: string, ip: string, outcome: 'success' | 'failure' | 'error') {
  await finishLogin(await allowedLogin(email, ip), outcome)
}

async function allowedRegistration(ip: string) {
  const result = await beginRegistration(ip)
  expect(result.status).toBe('allowed')
  return (result as { attempt_id: number }).attempt_id
}

function expectLockedForFifteenMinutes(result: BeginResult) {
  expect(result.status).toBe('locked')
  const remaining = Date.parse((result as { locked_until: string }).locked_until) - Date.now()
  expect(remaining).toBeGreaterThan(FIFTEEN_MINUTES - CLOCK_TOLERANCE)
  expect(remaining).toBeLessThan(FIFTEEN_MINUTES + CLOCK_TOLERANCE)
}

afterAll(async () => {
  await deleteTestAccounts()
}, TIMEOUT)

describe('Login-Bremse', { timeout: TIMEOUT }, () => {
  it('5 Fehlversuche pro Adresse sperren für 15 Minuten, auch ohne Konto zur Adresse (AC-6)', async () => {
    const email = uniqueEmail('lock-account')
    for (let i = 0; i < 5; i++) await loginAttempt(email, uniqueIp(), 'failure')

    expectLockedForFifteenMinutes(await beginLogin(email, uniqueIp()))
  })

  it('20 Fehlversuche pro IP sperren für 15 Minuten, auch für weitere Adressen (AC-6)', async () => {
    const ip = uniqueIp()
    for (let i = 0; i < 20; i++) await loginAttempt(uniqueEmail('lock-ip'), ip, 'failure')

    expectLockedForFifteenMinutes(await beginLogin(uniqueEmail('lock-ip'), ip))
  })

  it('Adressen werden normalisiert: Großbuchstaben und Leerzeichen am Rand zählen als dieselbe Adresse (EC-4)', async () => {
    const email = uniqueEmail('normalised')
    const variants = [` ${email.toUpperCase()} `, email, `${email} `, email.toUpperCase(), `  ${email}`]
    for (const variant of variants) await loginAttempt(variant, uniqueIp(), 'failure')

    expect((await beginLogin(email, uniqueIp())).status).toBe('locked')
  })

  it('ein Erfolg setzt die Zählung der Adresse zurück (EC-7)', async () => {
    const email = uniqueEmail('reset')
    for (let i = 0; i < 4; i++) await loginAttempt(email, uniqueIp(), 'failure')
    await loginAttempt(email, uniqueIp(), 'success')

    for (let i = 0; i < 4; i++) await loginAttempt(email, uniqueIp(), 'failure')
    await loginAttempt(email, uniqueIp(), 'error')
    await loginAttempt(email, uniqueIp(), 'failure')

    expect((await beginLogin(email, uniqueIp())).status).toBe('locked')
  })

  it('gleichzeitige Versuche rutschen nicht durch: höchstens 5 laufen an (AC-6)', async () => {
    const email = uniqueEmail('parallel')
    const results = await Promise.all(
      Array.from({ length: 12 }, () => beginLogin(email, uniqueIp()))
    )

    const allowed = results.filter((result) => result.status === 'allowed')
    expect(allowed).toHaveLength(5)
    for (const result of results.filter((r) => r.status === 'locked')) {
      expectLockedForFifteenMinutes(result)
    }
    for (const result of allowed) {
      await finishLogin((result as { attempt_id: number }).attempt_id, 'error')
    }
  })

  it('ein Versuch lässt sich nur einmal abschließen', async () => {
    const attemptId = await allowedLogin(uniqueEmail('finish-twice'), uniqueIp())
    await finishLogin(attemptId, 'failure')

    await expect(finishLogin(attemptId, 'success')).rejects.toMatchObject({ code: 'P0002' })
  })

  it('ohne IP oder mit leerer Adresse bricht die Funktion ab', async () => {
    await expect(beginLogin('   ', uniqueIp())).rejects.toMatchObject({ code: '22023' })
    await expect(
      rpc('license_center_begin_login', { p_email: uniqueEmail('no-ip'), p_ip_address: null })
    ).rejects.toMatchObject({ code: '22004' })
  })
})

describe('Registrierungsbremse', { timeout: TIMEOUT }, () => {
  it('zählt pending, success und duplicate, aber nicht error, und sperrt ab 5 (AC-8)', async () => {
    const ip = uniqueIp()
    for (let i = 0; i < 3; i++) await finishRegistration(await allowedRegistration(ip), 'error')

    await finishRegistration(await allowedRegistration(ip), 'success')
    await finishRegistration(await allowedRegistration(ip), 'duplicate')
    await allowedRegistration(ip) // still pending: counts
    await finishRegistration(await allowedRegistration(ip), 'success')
    await finishRegistration(await allowedRegistration(ip), 'duplicate')

    expect(await beginRegistration(ip)).toEqual({ status: 'locked' })
    expect((await beginRegistration(uniqueIp())).status).toBe('allowed')
  })
})

describe('Konto und Bremse', { timeout: TIMEOUT }, () => {
  it('license_center_email_registered erkennt eine registrierte Adresse, normalisiert', async () => {
    const account = await createTestAccount()

    expect(
      await rpc<boolean>('license_center_email_registered', { p_email: ` ${account.email.toUpperCase()} ` })
    ).toBe(true)
    expect(
      await rpc<boolean>('license_center_email_registered', { p_email: uniqueEmail('unknown') })
    ).toBe(false)
  })

  it('wird das Konto gelöscht, sind Kontosperre und Login-Versuche der Adresse weg (AC-12)', async () => {
    const account = await createTestAccount()
    for (let i = 0; i < 5; i++) await loginAttempt(account.email, uniqueIp(), 'failure')
    expect((await beginLogin(account.email, uniqueIp())).status).toBe('locked')

    const { error } = await admin.auth.admin.deleteUser(account.userId)
    expect(error).toBeNull()

    // With the lock gone but the five attempts still there, this would be "locked" again.
    await loginAttempt(account.email, uniqueIp(), 'error')
  })
})

describe('Zugriff auf die Bremsfunktionen', { timeout: TIMEOUT }, () => {
  const calls: Array<[string, Record<string, unknown>]> = [
    ['license_center_begin_login', { p_email: 'someone@example.com', p_ip_address: '2001:db8::1' }],
    ['license_center_finish_login', { p_attempt_id: 1, p_outcome: 'success' }],
    ['license_center_begin_registration', { p_ip_address: '2001:db8::1' }],
    ['license_center_finish_registration', { p_attempt_id: 1, p_outcome: 'success' }],
    ['license_center_email_registered', { p_email: 'someone@example.com' }],
  ]

  it('anon und authenticated dürfen keine der fünf Funktionen aufrufen', async () => {
    const account = await createTestAccount()
    const clients = { anon: createAnonTestClient(), authenticated: createUserTestClient(account.accessToken) }

    for (const [role, client] of Object.entries(clients)) {
      for (const [fn, args] of calls) {
        const { error } = await client.rpc(fn, args)
        expect({ role, fn, code: error?.code }).toEqual({ role, fn, code: PERMISSION_DENIED })
      }
    }
  })
})
