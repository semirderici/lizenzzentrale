// @vitest-environment node
// Tests for the session guard (design.md → Wächter), against the hosted project with real test
// accounts. The server client is replaced by a public-key client holding a test account's
// session, so every read goes through Row Level Security exactly as in the app.
import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import {
  createAdminTestClient,
  createAnonTestClient,
  createTestAccount,
  createUserTestClient,
  deleteTestAccounts,
  signInTestSession,
  type TestAccount,
} from '@/test/supabase'
import { getCurrentAdmin, requireTrainingProvider } from './session.data'

const TIMEOUT = 60_000
const SESSION_REDIRECT = '/login?reason=session'

// The client the mocked createClient() hands out, chosen per test.
const server = vi.hoisted(() => ({ client: undefined as SupabaseClient | undefined }))

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => {
    if (!server.client) throw new Error('This test did not choose a Supabase client.')
    return server.client
  },
}))

// Tripwire: the guard reads only with the visitor's session, never with the secret key
// (design.md → Grundsätze 2). Any use fails the test that triggered it.
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => {
    throw new Error('session.data.ts must never use the admin client.')
  },
}))

vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`)
  }),
}))

/** Signs the account in again for a full session (access and refresh token). */
async function signIn(account: TestAccount): Promise<Session> {
  // Through the admin key: the Supabase CAPTCHA blocks the public key (see src/test/supabase.ts).
  return signInTestSession(account.email, account.password)
}

/** The public key plus the session, as the server client holds it after reading the cookies. */
async function clientWithSession(session: Session) {
  const client = createAnonTestClient()
  const { error } = await client.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  })
  if (error) throw error
  return client
}

/**
 * A new request whose cookies still carry an old session. Like the server client of
 * @supabase/ssr, it takes the session from its storage without asking the Auth server.
 */
function clientWithStoredSession(session: Session) {
  const storageKey = 'session-guard-test'
  const stored = new Map([[storageKey, JSON.stringify(session)]])
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: {
      persistSession: true,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storageKey,
      storage: {
        getItem: (key) => stored.get(key) ?? null,
        setItem: (key, value) => void stored.set(key, value),
        removeItem: (key) => void stored.delete(key),
      },
    },
  })
}

/** The same session, but every table read fails in the database. */
function withFailingDatabase(client: SupabaseClient): SupabaseClient {
  return new Proxy(client, {
    get(target, property, receiver) {
      if (property === 'from') return () => target.from('license_center_table_that_does_not_exist')
      return Reflect.get(target, property, receiver)
    },
  })
}

async function trainingProviderIdOf(userId: string) {
  const { data, error } = await createAdminTestClient()
    .from('training_provider_members')
    .select('training_provider_id')
    .eq('user_id', userId)
    .single()
  if (error) throw error
  return data.training_provider_id as string
}

type SignedInAdmin = { account: TestAccount; session: Session; trainingProviderId: string }

let a: SignedInAdmin
let b: SignedInAdmin

async function signedInAdmin(trainingProviderName: string): Promise<SignedInAdmin> {
  const account = await createTestAccount({ userMetadata: { training_provider_name: trainingProviderName } })
  return {
    account,
    session: await signIn(account),
    trainingProviderId: await trainingProviderIdOf(account.userId),
  }
}

beforeAll(async () => {
  a = await signedInAdmin('Träger A')
  b = await signedInAdmin('Träger B')
}, TIMEOUT)

beforeEach(() => {
  server.client = undefined
  vi.mocked(redirect).mockClear()
})

afterAll(async () => {
  await deleteTestAccounts()
}, TIMEOUT)

describe('getCurrentAdmin', { timeout: TIMEOUT }, () => {
  it('liefert für A nur den Träger von A, nie den von B (AC-4, AC-11)', async () => {
    server.client = await clientWithSession(a.session)
    const forA = await getCurrentAdmin()
    expect(forA).toMatchObject({
      status: 'assigned',
      userId: a.account.userId,
      role: 'admin',
      trainingProvider: { id: a.trainingProviderId, name: 'Träger A', licenseQuota: 5 },
    })
    expect(forA).not.toMatchObject({ trainingProvider: { id: b.trainingProviderId } })

    server.client = await clientWithSession(b.session)
    const forB = await getCurrentAdmin()
    expect(forB).toMatchObject({
      status: 'assigned',
      userId: b.account.userId,
      trainingProvider: { id: b.trainingProviderId, name: 'Träger B', licenseQuota: 5 },
    })
  })

  it('liefert genau die Felder des Typs, keine weiteren Spalten (AC-4)', async () => {
    server.client = await clientWithSession(a.session)
    expect(await getCurrentAdmin()).toStrictEqual({
      status: 'assigned',
      userId: a.account.userId,
      role: 'admin',
      trainingProvider: { id: a.trainingProviderId, name: 'Träger A', licenseQuota: 5 },
    })
  })

  it('liefert „nicht zugeordnet“ mit der Konto-ID, wenn der Anbieter nur den Träger gelöscht hat (EC-5)', async () => {
    const orphan = await signedInAdmin('Gelöschter Träger')
    server.client = await clientWithSession(orphan.session)

    const deletion = await createAdminTestClient()
      .from('training_providers')
      .delete()
      .eq('id', orphan.trainingProviderId)
    expect(deletion.error).toBeNull()

    expect(await getCurrentAdmin()).toStrictEqual({ status: 'unassigned', userId: orphan.account.userId })
  })

  it('liefert „abgemeldet“ ohne Sitzung (AC-9)', async () => {
    server.client = createAnonTestClient()
    expect(await getCurrentAdmin()).toStrictEqual({ status: 'signed_out' })
  })

  it('liefert „abgemeldet“, sobald die Sitzung in einem anderen Tab beendet wurde, auch mit den alten Tokens (EC-6)', async () => {
    const admin = await signedInAdmin('Träger mit zwei Tabs')
    const otherTab = await clientWithSession(admin.session)
    const signOut = await otherTab.auth.signOut({ scope: 'local' })
    expect(signOut.error).toBeNull()

    // The database alone still accepts the old access token until it expires; only the Auth
    // server knows that the session has ended. That is why the guard has to ask it.
    const oldToken = await createUserTestClient(admin.session.access_token)
      .from('training_provider_members')
      .select('user_id')
    expect(oldToken.data).toEqual([{ user_id: admin.account.userId }])

    // A request whose cookies still carry the old session.
    server.client = clientWithStoredSession(admin.session)
    expect(await getCurrentAdmin()).toStrictEqual({ status: 'signed_out' })

    // A fresh client handed the old tokens: the Auth server already refuses them.
    const fresh = createAnonTestClient()
    const restored = await fresh.auth.setSession({
      access_token: admin.session.access_token,
      refresh_token: admin.session.refresh_token,
    })
    expect(restored.error).not.toBeNull()
    server.client = fresh
    expect(await getCurrentAdmin()).toStrictEqual({ status: 'signed_out' })
  })

  it('wirft einen Fehler, wenn die Mitgliedschaft nicht gelesen werden kann, statt „nicht zugeordnet“ zu melden (EC-5)', async () => {
    server.client = withFailingDatabase(await clientWithSession(a.session))
    await expect(getCurrentAdmin()).rejects.toMatchObject({
      message: 'Could not read the training provider membership.',
      cause: expect.objectContaining({ code: 'PGRST205' }),
    })
  })
})

describe('requireTrainingProvider', { timeout: TIMEOUT }, () => {
  it('leitet ohne Sitzung auf /login?reason=session weiter (AC-9, EC-6)', async () => {
    server.client = createAnonTestClient()
    await expect(requireTrainingProvider()).rejects.toThrow(`NEXT_REDIRECT ${SESSION_REDIRECT}`)
    expect(redirect).toHaveBeenCalledTimes(1)
    expect(redirect).toHaveBeenCalledWith(SESSION_REDIRECT)
  })

  it('reicht „zugeordnet“ und „nicht zugeordnet“ ohne Weiterleitung durch (AC-4, EC-5)', async () => {
    server.client = await clientWithSession(a.session)
    expect(await requireTrainingProvider()).toStrictEqual({
      status: 'assigned',
      userId: a.account.userId,
      role: 'admin',
      trainingProvider: { id: a.trainingProviderId, name: 'Träger A', licenseQuota: 5 },
    })

    const orphan = await signedInAdmin('Gelöschter Träger')
    const deletion = await createAdminTestClient()
      .from('training_providers')
      .delete()
      .eq('id', orphan.trainingProviderId)
    expect(deletion.error).toBeNull()
    server.client = await clientWithSession(orphan.session)
    expect(await requireTrainingProvider()).toStrictEqual({
      status: 'unassigned',
      userId: orphan.account.userId,
    })

    expect(redirect).not.toHaveBeenCalled()
  })
})
