// @vitest-environment node
// Against the hosted project with the real admin client; a few tests replace the client to
// simulate a database error or an unexpected answer.
import { randomBytes } from 'node:crypto'
import type { createAdminClient as CreateAdminClient } from '@/lib/supabase/admin'
import { createTestAccount, deleteTestAccounts, uniqueEmail } from '@/test/supabase'
import {
  beginLogin,
  beginRegistration,
  finishLogin,
  finishRegistration,
  isEmailRegistered,
} from './throttle.data'

const TIMEOUT = 60_000

let fakeAdminClient: unknown = null

vi.mock('@/lib/supabase/admin', async (importOriginal) => {
  const actual = await importOriginal<{ createAdminClient: typeof CreateAdminClient }>()
  return { createAdminClient: () => fakeAdminClient ?? actual.createAdminClient() }
})

function answer(data: unknown, error: unknown = null) {
  fakeAdminClient = { rpc: vi.fn().mockResolvedValue({ data, error }) }
}

/** A random address from the IPv6 documentation range, so runs never count each other. */
function uniqueIp() {
  return `2001:db8:${randomBytes(12).toString('hex').match(/.{4}/g)!.join(':')}`
}

afterEach(() => {
  fakeAdminClient = null
})

afterAll(async () => {
  await deleteTestAccounts()
}, TIMEOUT)

describe('Login-Bremse', { timeout: TIMEOUT }, () => {
  it('liefert „erlaubt“ mit Versuchsnummer und nach 5 Fehlversuchen „gesperrt bis“ als Zeitpunkt (AC-6)', async () => {
    const email = uniqueEmail('data-lock')
    for (let i = 0; i < 5; i++) {
      const result = await beginLogin(email, uniqueIp())
      expect(result).toEqual({ status: 'allowed', attemptId: expect.any(Number) })
      expect(await finishLogin((result as { attemptId: number }).attemptId, 'failure')).toBe(true)
    }

    const locked = await beginLogin(email, uniqueIp())
    expect(locked.status).toBe('locked')
    const lockedUntil = (locked as { lockedUntil: Date }).lockedUntil
    expect(lockedUntil).toBeInstanceOf(Date)
    expect(lockedUntil.getTime() - Date.now()).toBeGreaterThan(14 * 60_000)
    expect(lockedUntil.getTime() - Date.now()).toBeLessThan(16 * 60_000)
  })

  it('meldet false, wenn ein Versuch nicht mehr offen ist', async () => {
    const result = await beginLogin(uniqueEmail('data-twice'), uniqueIp())
    const id = (result as { attemptId: number }).attemptId
    expect(await finishLogin(id, 'success')).toBe(true)

    expect(await finishLogin(id, 'failure')).toBe(false)
  })

  it('macht aus einem Datenbankfehler einen Fehler, nie „erlaubt“ (AC-6)', async () => {
    expect(await beginLogin(uniqueEmail('data-bad-ip'), 'keine-ip')).toEqual({ status: 'error' })

    answer(null, { code: '57014', message: 'canceling statement due to statement timeout' })
    expect(await beginLogin(uniqueEmail('data-error'), uniqueIp())).toEqual({ status: 'error' })
  })

  it('macht aus einer unerwarteten Antwort einen Fehler, nie „erlaubt“', async () => {
    for (const data of [
      null,
      { status: 'allowed' },
      { status: 'allowed', attempt_id: '7' },
      { status: 'locked' },
      { status: 'locked', locked_until: 'bald' },
      { status: 'maybe', attempt_id: 7 },
    ]) {
      answer(data)
      expect(await beginLogin(uniqueEmail('data-odd'), uniqueIp())).toEqual({ status: 'error' })
    }
  })

  it('macht aus einer Ausnahme im Client einen Fehler', async () => {
    fakeAdminClient = { rpc: vi.fn().mockRejectedValue(new TypeError('fetch failed')) }

    expect(await beginLogin(uniqueEmail('data-throw'), uniqueIp())).toEqual({ status: 'error' })
    expect(await finishLogin(1, 'failure')).toBe(false)
  })
})

describe('Registrierungsbremse', { timeout: TIMEOUT }, () => {
  it('liefert „erlaubt“ und nach 5 gezählten Registrierungen „gesperrt“ (AC-8)', async () => {
    const ip = uniqueIp()
    for (let i = 0; i < 5; i++) {
      const result = await beginRegistration(ip)
      expect(result).toEqual({ status: 'allowed', attemptId: expect.any(Number) })
      expect(await finishRegistration((result as { attemptId: number }).attemptId, 'success')).toBe(true)
    }

    expect(await beginRegistration(ip)).toEqual({ status: 'locked' })
  })

  it('macht aus Fehlern und unerwarteten Antworten einen Fehler, nie „erlaubt“ (AC-8)', async () => {
    expect(await beginRegistration('keine-ip')).toEqual({ status: 'error' })
    expect(await finishRegistration(-1, 'success')).toBe(false)

    for (const data of [null, { status: 'allowed' }, { status: 'free' }, 'allowed']) {
      answer(data)
      expect(await beginRegistration(uniqueIp())).toEqual({ status: 'error' })
    }
  })
})

describe('isEmailRegistered', { timeout: TIMEOUT }, () => {
  it('erkennt eine registrierte Adresse und eine unbekannte (EC-2)', async () => {
    const account = await createTestAccount()

    expect(await isEmailRegistered(account.email)).toBe(true)
    expect(await isEmailRegistered(uniqueEmail('unknown'))).toBe(false)
  })

  it('liefert null, wenn die Nachfrage scheitert, nie ein Ja oder Nein (EC-2)', async () => {
    answer(null, { code: '42501', message: 'permission denied' })
    expect(await isEmailRegistered('someone@example.com')).toBeNull()

    answer('yes')
    expect(await isEmailRegistered('someone@example.com')).toBeNull()
  })
})
