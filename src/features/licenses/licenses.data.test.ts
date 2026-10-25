// @vitest-environment node
// Tests for the licence data access (design.md → Abläufe und Zugriff), against the hosted project
// with real test accounts. The server client is replaced by a public-key client holding a test
// account's token, so every query goes through Row Level Security exactly as in the app.
import { randomUUID } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  createAdminTestClient,
  createSignedInTestAccount,
  createTestAccount,
  createUserTestClient,
  deleteTestAccounts,
} from '@/test/supabase'
import { deleteLicense, insertLicense, listLicenses } from './licenses.data'

const TIMEOUT = 60_000

// The client the mocked createClient() hands out, chosen per test; `fail` makes it throw.
const server = vi.hoisted(() => ({ client: undefined as SupabaseClient | undefined, fail: false }))

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => {
    if (server.fail) throw new Error('Supabase is not reachable.')
    if (!server.client) throw new Error('This test did not choose a Supabase client.')
    return server.client
  },
}))

// Tripwire: licences are read and written only with the administrator's session, never with the
// secret key (design.md → Grundsätze 3). Any use fails the test that triggered it.
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => {
    throw new Error('licenses.data.ts must never use the admin client.')
  },
}))

function participant(label = 'teilnehmer') {
  return `${label}-${randomUUID()}@example.com`
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

async function setQuota(trainingProviderId: string, licenseQuota: number) {
  const { error } = await createAdminTestClient()
    .from('training_providers')
    .update({ license_quota: licenseQuota })
    .eq('id', trainingProviderId)
  if (error) throw error
}

async function assignAsAdmin(trainingProviderId: string, email: string, assignedAt?: string) {
  const { data, error } = await createAdminTestClient()
    .from('licenses')
    .insert({ training_provider_id: trainingProviderId, email, ...(assignedAt ? { assigned_at: assignedAt } : {}) })
    .select('id')
    .single()
  if (error) throw error
  return data.id as string
}

async function licenseExists(licenseId: string) {
  const { data, error } = await createAdminTestClient().from('licenses').select('id').eq('id', licenseId)
  if (error) throw error
  return data.length === 1
}

/** The same session, but every table query fails in the database. */
function withFailingDatabase(client: SupabaseClient): SupabaseClient {
  return new Proxy(client, {
    get(target, property, receiver) {
      if (property === 'from') return () => target.from('license_center_table_that_does_not_exist')
      return Reflect.get(target, property, receiver)
    },
  })
}

/** One signed-in administrator per describe: Supabase limits sign-ins per IP. */
async function signedInAdmin() {
  const account = await createSignedInTestAccount({ userMetadata: { training_provider_name: 'Träger A' } })
  return {
    client: createUserTestClient(account.accessToken),
    trainingProviderId: await trainingProviderIdOf(account.userId),
  }
}

async function otherTrainingProviderId() {
  const account = await createTestAccount({ userMetadata: { training_provider_name: 'Träger B' } })
  return trainingProviderIdOf(account.userId)
}

afterEach(() => {
  server.client = undefined
  server.fail = false
})

afterAll(async () => {
  await deleteTestAccounts()
}, TIMEOUT)

describe('listLicenses', { timeout: TIMEOUT }, () => {
  let a: Awaited<ReturnType<typeof signedInAdmin>>
  beforeAll(async () => {
    a = await signedInAdmin()
  }, TIMEOUT)

  it('liefert nur die Lizenzen des eigenen Trägers, die neueste oben, bei gleichem Zeitpunkt nach ID (AC-2, AC-10)', async () => {
    const providerB = await otherTrainingProviderId()
    const oldest = { email: participant('alt'), at: '2026-10-01T08:00:00.000Z' }
    const newest = { email: participant('neu'), at: '2026-10-03T08:00:00.000Z' }
    const sameTime = '2026-10-02T08:00:00.000Z'
    const oldestId = await assignAsAdmin(a.trainingProviderId, oldest.email, oldest.at)
    const newestId = await assignAsAdmin(a.trainingProviderId, newest.email, newest.at)
    const tied = [participant('gleich'), participant('gleich')]
    const tiedIds = [
      await assignAsAdmin(a.trainingProviderId, tied[0], sameTime),
      await assignAsAdmin(a.trainingProviderId, tied[1], sameTime),
    ]
    await assignAsAdmin(providerB, participant('b'))
    server.client = a.client

    const result = await listLicenses(a.trainingProviderId)

    expect(result.status).toBe('ok')
    const licenses = result.status === 'ok' ? result.licenses : []
    const [first, second] = tiedIds[0] > tiedIds[1] ? [0, 1] : [1, 0]
    expect(licenses.map((license) => license.id)).toEqual([newestId, tiedIds[first], tiedIds[second], oldestId])
    expect(licenses[0]).toEqual({ id: newestId, email: newest.email, assignedAt: expect.any(String) })
    expect(new Date(licenses[0].assignedAt).toISOString()).toBe(newest.at)
  })

  it('liefert für einen fremden Träger keine Zeile, weil RLS sie verbirgt (AC-10)', async () => {
    const providerB = await otherTrainingProviderId()
    await assignAsAdmin(providerB, participant('b'))
    server.client = a.client

    expect(await listLicenses(providerB)).toEqual({ status: 'ok', licenses: [] })
  })

  it('meldet einen Ladefehler statt einer leeren Liste, wenn die Datenbank scheitert (EC-6)', async () => {
    server.client = withFailingDatabase(a.client)

    expect(await listLicenses(a.trainingProviderId)).toEqual({ status: 'load_error' })
  })

  it('meldet einen Ladefehler, wenn Supabase gar nicht erreichbar ist (EC-6)', async () => {
    server.fail = true

    expect(await listLicenses(a.trainingProviderId)).toEqual({ status: 'load_error' })
  })
})

describe('insertLicense', { timeout: TIMEOUT }, () => {
  let a: Awaited<ReturnType<typeof signedInAdmin>>
  beforeAll(async () => {
    a = await signedInAdmin()
  }, TIMEOUT)

  it('legt die Lizenz an und liefert ihre ID (AC-4)', async () => {
    const email = participant()
    server.client = a.client

    const result = await insertLicense(a.trainingProviderId, email)

    expect(result).toEqual({ status: 'created', id: expect.any(String) })
    const { data } = await createAdminTestClient()
      .from('licenses')
      .select('training_provider_id, email')
      .eq('id', (result as { id: string }).id)
      .single()
    expect(data).toEqual({ training_provider_id: a.trainingProviderId, email })
  })

  it('meldet „schon vergeben“, wenn die Adresse beim eigenen Träger schon eine Lizenz hat (AC-6)', async () => {
    const email = participant()
    await assignAsAdmin(a.trainingProviderId, email)
    server.client = a.client

    expect(await insertLicense(a.trainingProviderId, email)).toEqual({ status: 'already_assigned' })
  })

  it('meldet „ausgeschöpft“, wenn keine Lizenz mehr frei ist (AC-7)', async () => {
    const { count } = await createAdminTestClient()
      .from('licenses')
      .select('id', { count: 'exact', head: true })
      .eq('training_provider_id', a.trainingProviderId)
    await setQuota(a.trainingProviderId, count ?? 0)
    server.client = a.client

    try {
      expect(await insertLicense(a.trainingProviderId, participant())).toEqual({ status: 'exhausted' })
    } finally {
      await setQuota(a.trainingProviderId, 50)
    }
  })

  it('meldet einen Fehler für einen fremden Träger (42501) und legt nichts an (AC-10)', async () => {
    const providerB = await otherTrainingProviderId()
    server.client = a.client

    expect(await insertLicense(providerB, participant())).toEqual({ status: 'failed' })
    const { data } = await createAdminTestClient().from('licenses').select('id').eq('training_provider_id', providerB)
    expect(data).toEqual([])
  })

  it('meldet einen Fehler, wenn die Datenbank scheitert oder Supabase nicht erreichbar ist (EC-5)', async () => {
    server.client = withFailingDatabase(a.client)
    expect(await insertLicense(a.trainingProviderId, participant())).toEqual({ status: 'failed' })

    server.fail = true
    expect(await insertLicense(a.trainingProviderId, participant())).toEqual({ status: 'failed' })
  })
})

describe('deleteLicense', { timeout: TIMEOUT }, () => {
  let a: Awaited<ReturnType<typeof signedInAdmin>>
  beforeAll(async () => {
    a = await signedInAdmin()
  }, TIMEOUT)

  it('entzieht die Lizenz; ein zweites Entziehen findet nichts mehr (AC-8, EC-3)', async () => {
    const licenseId = await assignAsAdmin(a.trainingProviderId, participant())
    server.client = a.client

    expect(await deleteLicense(a.trainingProviderId, licenseId)).toEqual({ status: 'revoked' })
    expect(await licenseExists(licenseId)).toBe(false)
    expect(await deleteLicense(a.trainingProviderId, licenseId)).toEqual({ status: 'not_found' })
  })

  it('findet die Lizenz eines fremden Trägers nicht, und sie bleibt bestehen (AC-10, EC-3)', async () => {
    const providerB = await otherTrainingProviderId()
    const licenseB = await assignAsAdmin(providerB, participant('b'))
    server.client = a.client

    expect(await deleteLicense(a.trainingProviderId, licenseB)).toEqual({ status: 'not_found' })
    expect(await deleteLicense(providerB, licenseB)).toEqual({ status: 'not_found' })
    expect(await licenseExists(licenseB)).toBe(true)
  })

  it('meldet einen Fehler, wenn die Datenbank scheitert oder Supabase nicht erreichbar ist (EC-5)', async () => {
    const licenseId = await assignAsAdmin(a.trainingProviderId, participant())
    server.client = withFailingDatabase(a.client)
    expect(await deleteLicense(a.trainingProviderId, licenseId)).toEqual({ status: 'failed' })

    server.fail = true
    expect(await deleteLicense(a.trainingProviderId, licenseId)).toEqual({ status: 'failed' })
    expect(await licenseExists(licenseId)).toBe(true)
  })
})
