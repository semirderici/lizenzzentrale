// @vitest-environment node
// Against the hosted project. The Next.js cookie store is an in-memory jar here, so the tests
// see exactly which session cookies the module writes and removes. A few tests replace the
// admin or server client to simulate errors Supabase cannot be made to produce on demand.
import { randomUUID } from 'node:crypto'
import type { createAdminClient as CreateAdminClient } from '@/lib/supabase/admin'
import {
  createAdminTestClient,
  createAnonTestClient,
  createTestAccount,
  deleteTestAccounts,
  registerForCleanup,
  uniqueEmail,
  uniquePassword,
} from '@/test/supabase'
import { signInWithPassword, signOutCurrentSession, signUpTrainingProvider } from './auth.data'

const TIMEOUT = 60_000

type StoredCookie = { value: string; options: Record<string, unknown> }
const jar = new Map<string, StoredCookie>()
let fakeAdminClient: unknown = null
let fakeServerClient: unknown = null

vi.mock('@/lib/supabase/admin', async (importOriginal) => {
  const actual = await importOriginal<{ createAdminClient: typeof CreateAdminClient }>()
  return { createAdminClient: () => fakeAdminClient ?? actual.createAdminClient() }
})

vi.mock('@/lib/supabase/server', async () => {
  const { createServerClient } = await import('@supabase/ssr')
  const { sessionCookieOptions } = await import('@/lib/supabase/cookie-options')
  return {
    createClient: async () =>
      fakeServerClient ??
      createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
        cookieOptions: sessionCookieOptions('https:'),
        cookies: {
          getAll: () => [...jar].map(([name, { value }]) => ({ name, value })),
          setAll: (cookies) => {
            for (const { name, value, options } of cookies) {
              if (value === '' || options?.maxAge === 0) jar.delete(name)
              else jar.set(name, { value, options: { ...options } })
            }
          },
        },
      }),
  }
})

vi.mock('next/headers', () => ({
  cookies: async () => ({
    getAll: () => [...jar].map(([name, { value }]) => ({ name, value })),
    delete: (name: string) => jar.delete(name),
  }),
}))

/** Supabase rejects example and test domains on sign-up; nothing is ever sent (Confirm email is off). */
function signUpEmail() {
  return `lizenzzentrale-test-signup-${randomUUID()}@lizenzzentrale-test.de`
}

function sessionCookies() {
  return [...jar].filter(([name]) => name.startsWith('sb-') && name.includes('-auth-token'))
}

async function signedInUserId() {
  const { createClient } = await import('@/lib/supabase/server')
  const { data } = await (await createClient()).auth.getUser()
  return data.user?.id ?? null
}

function adminAuthAnswers(answer: unknown) {
  fakeAdminClient = {
    auth: {
      signUp: vi.fn().mockImplementation(async () => (answer instanceof Error ? Promise.reject(answer) : answer)),
      signInWithPassword: vi
        .fn()
        .mockImplementation(async () => (answer instanceof Error ? Promise.reject(answer) : answer)),
    },
  }
}

function authError(status: number, code: string) {
  return { data: { user: null, session: null }, error: Object.assign(new Error(code), { status, code }) }
}

beforeEach(() => {
  jar.clear()
})

afterEach(() => {
  fakeAdminClient = null
  fakeServerClient = null
})

afterAll(async () => {
  await deleteTestAccounts()
}, TIMEOUT)

describe('signInWithPassword', { timeout: TIMEOUT }, () => {
  it('meldet mit richtigem Passwort über den Admin-Schlüssel an und legt die Sitzung als HttpOnly-Cookie ab (AC-4, AC-10)', async () => {
    const account = await createTestAccount()

    expect(await signInWithPassword(account.email, account.password)).toEqual({ status: 'success' })

    const cookies = sessionCookies()
    expect(cookies.length).toBeGreaterThan(0)
    for (const [, { options }] of cookies) {
      expect(options).toMatchObject({ httpOnly: true, sameSite: 'lax', secure: true })
      // Lifetime as Supabase sets it: a persistent cookie, not a session cookie.
      expect(options.maxAge).toBeGreaterThan(30 * 24 * 60 * 60)
    }
    expect(await signedInUserId()).toBe(account.userId)
  })

  it('antwortet für ein falsches Passwort und eine unbekannte Adresse gleich und setzt kein Cookie (AC-5)', async () => {
    const account = await createTestAccount()

    expect(await signInWithPassword(account.email, uniquePassword())).toEqual({ status: 'invalid_credentials' })
    expect(await signInWithPassword(uniqueEmail('unknown'), uniquePassword())).toEqual({
      status: 'invalid_credentials',
    })
    expect(jar.size).toBe(0)
  })

  it.each([
    ['Supabases eigene Grenze (429)', authError(429, 'over_request_rate_limit'), 'auth_rate_limited'],
    ['ein unbekannter Fehler', authError(500, 'unexpected_failure'), 'failed'],
    ['ein Abbruch der Verbindung', new TypeError('fetch failed'), 'failed'],
  ])('übersetzt %s und setzt kein Cookie (AC-6)', async (_case, answer, status) => {
    adminAuthAnswers(answer)

    expect(await signInWithPassword('someone@example.com', uniquePassword())).toEqual({ status })
    expect(jar.size).toBe(0)
  })
})

describe('signUpTrainingProvider', { timeout: TIMEOUT }, () => {
  it('legt Konto, Träger und Mitgliedschaft an und meldet sofort an (AC-1)', async () => {
    const email = signUpEmail()

    expect(
      await signUpTrainingProvider({ email, password: uniquePassword(), trainingProviderName: 'Akademie Süd' })
    ).toEqual({ status: 'success' })

    const userId = await signedInUserId()
    expect(userId).not.toBeNull()
    registerForCleanup(userId!)
    for (const [, { options }] of sessionCookies()) expect(options).toMatchObject({ httpOnly: true })

    const membership = await createAdminTestClient()
      .from('training_provider_members')
      .select('role, training_providers ( name, license_quota )')
      .eq('user_id', userId!)
      .single()
    expect(membership.data).toEqual({
      role: 'admin',
      training_providers: { name: 'Akademie Süd', license_quota: 5 },
    })
  })

  it('meldet eine schon registrierte Adresse als duplicate und legt nichts zusätzlich an (AC-3)', async () => {
    const email = signUpEmail()
    const first = await signUpTrainingProvider({ email, password: uniquePassword(), trainingProviderName: 'Erster' })
    expect(first).toEqual({ status: 'success' })
    const userId = (await signedInUserId())!
    registerForCleanup(userId)
    jar.clear()

    expect(
      await signUpTrainingProvider({ email, password: uniquePassword(), trainingProviderName: 'Zweiter' })
    ).toEqual({ status: 'duplicate' })
    expect(jar.size).toBe(0)

    const providers = await createAdminTestClient().from('training_providers').select('id').eq('name', 'Zweiter')
    const memberships = await createAdminTestClient()
      .from('training_provider_members')
      .select('training_providers ( name )')
      .eq('user_id', userId)
    expect(memberships.data).toEqual([{ training_providers: { name: 'Erster' } }])
    expect(providers.data?.length ?? 0).toBe(0)
  })

  it.each([
    ['user_already_exists', authError(422, 'user_already_exists'), 'duplicate'],
    ['email_exists', authError(422, 'email_exists'), 'duplicate'],
    ['Supabases eigene Grenze (429)', authError(429, 'over_request_rate_limit'), 'auth_rate_limited'],
    ['ein abgelehntes Passwort', authError(422, 'weak_password'), 'password_rejected'],
    ['ein allgemeiner Fehler (Verlierer aus EC-2)', authError(500, 'unexpected_failure'), 'failed'],
    ['ein Abbruch der Verbindung', new TypeError('fetch failed'), 'failed'],
    ['eine Antwort ohne Sitzung', { data: { user: { id: 'u1' }, session: null }, error: null }, 'failed'],
  ])('übersetzt %s und setzt kein Cookie (AC-3, AC-8, EC-3)', async (_case, answer, status) => {
    adminAuthAnswers(answer)

    expect(
      await signUpTrainingProvider({ email: signUpEmail(), password: uniquePassword(), trainingProviderName: 'X Y' })
    ).toEqual({ status })
    expect(jar.size).toBe(0)
  })
})

describe('Supabase-CAPTCHA am Formular vorbei (tasks.md T18)', { timeout: TIMEOUT }, () => {
  it('direkt mit dem öffentlichen Schlüssel scheitern Registrierung und Login mit captcha_failed (AC-7)', async () => {
    const anon = createAnonTestClient()
    const email = signUpEmail()

    const signUp = await anon.auth.signUp({
      email,
      password: uniquePassword(),
      options: { data: { training_provider_name: 'Am Formular vorbei' } },
    })
    if (signUp.data.user) registerForCleanup(signUp.data.user.id)
    expect(signUp.error?.code).toBe('captcha_failed')
    expect(signUp.data.session).toBeNull()
    const registered = await createAdminTestClient().rpc('license_center_email_registered', { p_email: email })
    expect(registered.data).toBe(false)

    const account = await createTestAccount()
    const signIn = await createAnonTestClient().auth.signInWithPassword({
      email: account.email,
      password: account.password,
    })
    expect(signIn.error?.code).toBe('captcha_failed')
    expect(signIn.data.session).toBeNull()
  })
})

describe('Mindestlänge Passwort in Supabase (tasks.md T17)', { timeout: TIMEOUT }, () => {
  it('Supabase lehnt 7 Zeichen ab und nimmt 8 Kleinbuchstaben ohne weitere Zeichenarten an (AC-2)', async () => {
    expect(
      await signUpTrainingProvider({ email: signUpEmail(), password: 'lizenze', trainingProviderName: 'Zu kurz' })
    ).toEqual({ status: 'password_rejected' })
    expect(jar.size).toBe(0)

    expect(
      await signUpTrainingProvider({ email: signUpEmail(), password: 'lizenzen', trainingProviderName: 'Genau acht' })
    ).toEqual({ status: 'success' })
    registerForCleanup((await signedInUserId())!)
  })
})

/** Row count of auth.audit_log_entries, through the admin endpoint of Supabase Auth that reads that table. */
async function auditLogRowCount() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/admin/audit?per_page=1`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  })
  const total = response.headers.get('x-total-count')
  if (!response.ok || total === null) throw new Error(`admin/audit answered ${response.status} without a count`)
  return Number(total)
}

// BUG-1: T4 was ticked, yet Supabase kept writing the audit log, with account ID and address of
// every deleted account. Only an empty table proves the setting (and the one-off cleanup) holds.
describe('Audit-Log nicht in der Datenbank (tasks.md T4)', { timeout: TIMEOUT }, () => {
  it('nach Registrierung, Abmeldung und Löschung eines Kontos steht keine Zeile im Audit-Log der Datenbank (AC-12)', async () => {
    expect(
      await signUpTrainingProvider({ email: signUpEmail(), password: uniquePassword(), trainingProviderName: 'Audit' })
    ).toEqual({ status: 'success' })
    const userId = (await signedInUserId())!
    registerForCleanup(userId)
    await signOutCurrentSession()
    const { error } = await createAdminTestClient().auth.admin.deleteUser(userId)
    if (error) throw error

    expect(await auditLogRowCount()).toBe(0)
  })
})

describe('signOutCurrentSession', { timeout: TIMEOUT }, () => {
  it('beendet genau diese Sitzung, löscht die Cookies, und das alte Refresh-Token taugt nichts mehr (AC-10)', async () => {
    const account = await createTestAccount()
    await signInWithPassword(account.email, account.password)
    const { createClient } = await import('@/lib/supabase/server')
    const { data } = await (await createClient()).auth.getSession()
    const oldRefreshToken = data.session!.refresh_token

    expect(await signOutCurrentSession()).toEqual({ hadSession: true })

    expect(sessionCookies()).toEqual([])
    const refresh = await createAnonTestClient().auth.refreshSession({ refresh_token: oldRefreshToken })
    expect(refresh.error).not.toBeNull()
    expect(refresh.data.session).toBeNull()
  })

  it('meldet ohne Sitzung hadSession: false (EC-6)', async () => {
    expect(await signOutCurrentSession()).toEqual({ hadSession: false })
    expect(jar.size).toBe(0)
  })

  it('löscht die Cookies auch, wenn Supabase beim Abmelden nicht erreichbar ist', async () => {
    jar.set('sb-project-auth-token', { value: 'base64-abc', options: {} })
    jar.set('sb-project-auth-token.1', { value: 'def', options: {} })
    jar.set('other-cookie', { value: 'keep', options: {} })
    fakeServerClient = {
      auth: {
        getUser: async () => ({ data: { user: { id: 'u1' } }, error: null }),
        signOut: async () => ({ error: new TypeError('fetch failed') }),
      },
    }

    expect(await signOutCurrentSession()).toEqual({ hadSession: true })
    expect([...jar.keys()]).toEqual(['other-cookie'])
  })
})
