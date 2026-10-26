// @vitest-environment node
// Database tests for supabase/migrations/20261025120000_proj2_licenses.sql and
// 20261026120000_proj2_licenses_email_rule.sql, run against the hosted project with real test
// accounts. Participant addresses come from example.com only.
import { randomUUID } from 'node:crypto'
import { assignLicenseSchema } from '@/features/licenses/licenses.schema'
import {
  createAdminTestClient,
  createAnonTestClient,
  createSignedInTestAccount,
  createTestAccount,
  createUserTestClient,
  deleteTestAccounts,
} from '@/test/supabase'

const TIMEOUT = 60_000
const PERMISSION_DENIED = '42501'
const UNIQUE_VIOLATION = '23505'
const CHECK_VIOLATION = '23514'
const RAISED = 'P0001'

/** A participant address that no other test uses. */
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

/** The provider's change in the Supabase table view. */
async function setQuota(trainingProviderId: string, licenseQuota: number) {
  const { error } = await createAdminTestClient()
    .from('training_providers')
    .update({ license_quota: licenseQuota })
    .eq('id', trainingProviderId)
  if (error) throw error
}

/** Assigns through service_role: no RLS, but the trigger still checks quota and duplicates. */
async function assignAsAdmin(trainingProviderId: string, emails: string[]) {
  const { data, error } = await createAdminTestClient()
    .from('licenses')
    .insert(emails.map((email) => ({ training_provider_id: trainingProviderId, email })))
    .select('id, email')
  if (error) throw error
  return data as { id: string; email: string }[]
}

async function licenseEmailsOf(trainingProviderId: string) {
  const { data, error } = await createAdminTestClient()
    .from('licenses')
    .select('email')
    .eq('training_provider_id', trainingProviderId)
  if (error) throw error
  return data.map((row) => row.email as string).sort()
}

/** A signed-in administrator, the client holding their token, and their training provider. */
async function signedInAdmin(name = 'Träger A') {
  const account = await createSignedInTestAccount({ userMetadata: { training_provider_name: name } })
  return {
    account,
    client: createUserTestClient(account.accessToken),
    trainingProviderId: await trainingProviderIdOf(account.userId),
  }
}

/** A second training provider whose administrator never signs in. */
async function otherTrainingProvider(name = 'Träger B') {
  const account = await createTestAccount({ userMetadata: { training_provider_name: name } })
  return { account, trainingProviderId: await trainingProviderIdOf(account.userId) }
}

afterAll(async () => {
  await deleteTestAccounts()
}, TIMEOUT)

describe('Zuweisen über die Daten-API mit dem Token des Verwalters', { timeout: TIMEOUT }, () => {
  it('legt eine Lizenz an, obwohl das Ausführen der Prüffunktion entzogen ist: genau vier Spalten, den Zeitpunkt setzt die Datenbank (AC-4, AC-12)', async () => {
    const a = await signedInAdmin()
    const email = participant()
    const before = Date.now()

    const { data, error } = await a.client
      .from('licenses')
      .insert({ training_provider_id: a.trainingProviderId, email })
      .select('*')
      .single()

    expect(error).toBeNull()
    expect(Object.keys(data!).sort()).toEqual(['assigned_at', 'email', 'id', 'training_provider_id'])
    expect(data).toMatchObject({ training_provider_id: a.trainingProviderId, email })
    expect(Math.abs(new Date(data!.assigned_at).getTime() - before)).toBeLessThan(30_000)
  })

  it('dieselbe Adresse beim eigenen Träger wird abgelehnt, ohne die Adresse im Fehler; bei einem anderen Träger wird sie normal angelegt (AC-6)', async () => {
    const a = await signedInAdmin()
    const b = await otherTrainingProvider()
    const email = participant()
    await assignAsAdmin(a.trainingProviderId, [email])

    const again = await a.client.from('licenses').insert({ training_provider_id: a.trainingProviderId, email })
    expect(again.error?.code).toBe(UNIQUE_VIOLATION)
    expect(again.error?.message).toBe('license_already_assigned')
    expect(JSON.stringify(again.error)).not.toContain(email)

    // Other spelling: the app normalises; the column rule rejects what was not normalised.
    for (const spelling of [email.toUpperCase(), ` ${email} `]) {
      const variant = await a.client
        .from('licenses')
        .insert({ training_provider_id: a.trainingProviderId, email: spelling })
      expect(variant.error?.code).toBe(CHECK_VIOLATION)
    }
    expect(await licenseEmailsOf(a.trainingProviderId)).toEqual([email])

    expect(await assignAsAdmin(b.trainingProviderId, [email])).toHaveLength(1)
  })

  it('bei vollem Kontingent: eine neue Adresse endet mit license_quota_exhausted, eine schon vergebene mit 23505 (AC-7, EC-2)', async () => {
    const a = await signedInAdmin()
    const assigned = [participant(), participant()]
    await setQuota(a.trainingProviderId, 2)
    await assignAsAdmin(a.trainingProviderId, assigned)

    const fresh = participant()
    const exhausted = await a.client
      .from('licenses')
      .insert({ training_provider_id: a.trainingProviderId, email: fresh })
    expect(exhausted.error?.code).toBe(RAISED)
    expect(exhausted.error?.message).toBe('license_quota_exhausted')
    expect(JSON.stringify(exhausted.error)).not.toContain(fresh)

    const duplicate = await a.client
      .from('licenses')
      .insert({ training_provider_id: a.trainingProviderId, email: assigned[0] })
    expect(duplicate.error?.code).toBe(UNIQUE_VIOLATION)

    expect(await licenseEmailsOf(a.trainingProviderId)).toEqual([...assigned].sort())
  })

  it('senkt der Anbieter das Kontingent unter die Zahl der Lizenzen, bleiben alle; neue scheitern, bis er es wieder hebt (AC-9, EC-10)', async () => {
    const a = await signedInAdmin()
    const assigned = [participant(), participant(), participant(), participant(), participant()]
    await assignAsAdmin(a.trainingProviderId, assigned)

    await setQuota(a.trainingProviderId, 3)
    const visible = await a.client.from('licenses').select('email')
    expect(visible.data).toHaveLength(5)
    const blocked = await a.client
      .from('licenses')
      .insert({ training_provider_id: a.trainingProviderId, email: participant() })
    expect(blocked.error?.message).toBe('license_quota_exhausted')

    await setQuota(a.trainingProviderId, 6)
    const allowed = await a.client
      .from('licenses')
      .insert({ training_provider_id: a.trainingProviderId, email: participant() })
    expect(allowed.error).toBeNull()
    expect(await licenseEmailsOf(a.trainingProviderId)).toHaveLength(6)
  })

  it('nach dem Entziehen ist die Lizenz sofort wieder frei, auch für dieselbe Adresse (AC-8)', async () => {
    const a = await signedInAdmin()
    await setQuota(a.trainingProviderId, 1)
    const email = participant()
    const [license] = await assignAsAdmin(a.trainingProviderId, [email])

    const revoked = await a.client.from('licenses').delete().eq('id', license.id).select('id')
    expect(revoked.error).toBeNull()
    expect(revoked.data).toEqual([{ id: license.id }])

    const reassigned = await a.client
      .from('licenses')
      .insert({ training_provider_id: a.trainingProviderId, email })
    expect(reassigned.error).toBeNull()
  })
})

describe('Gleichzeitige Anfragen', { timeout: TIMEOUT }, () => {
  it('fünf gleichzeitige Anlagen mit verschiedenen Adressen auf die letzte freie Lizenz: genau eine gelingt (EC-1)', async () => {
    const a = await signedInAdmin()
    await assignAsAdmin(a.trainingProviderId, [participant(), participant(), participant(), participant()])

    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        a.client.from('licenses').insert({ training_provider_id: a.trainingProviderId, email: participant() })
      )
    )

    expect(results.filter((result) => result.error === null)).toHaveLength(1)
    const failures = results.filter((result) => result.error !== null)
    expect(failures.map((result) => result.error!.message)).toEqual(Array(4).fill('license_quota_exhausted'))
    expect(await licenseEmailsOf(a.trainingProviderId)).toHaveLength(5)
  })

  it('drei gleichzeitige Anlagen derselben Adresse auf die letzte freie Lizenz: genau eine, die anderen enden mit 23505 (EC-2)', async () => {
    const a = await signedInAdmin()
    await assignAsAdmin(a.trainingProviderId, [participant(), participant(), participant(), participant()])
    const email = participant()

    const results = await Promise.all(
      Array.from({ length: 3 }, () =>
        a.client.from('licenses').insert({ training_provider_id: a.trainingProviderId, email })
      )
    )

    expect(results.filter((result) => result.error === null)).toHaveLength(1)
    const failures = results.filter((result) => result.error !== null)
    expect(failures.map((result) => result.error!.code)).toEqual([UNIQUE_VIOLATION, UNIQUE_VIOLATION])
    expect(await licenseEmailsOf(a.trainingProviderId)).toHaveLength(5)
  })
})

describe('Regel der Spalte (AC-5)', { timeout: TIMEOUT }, () => {
  // One list for both sides: the app's schema and the column rule judge every address alike, so
  // the data API accepts nothing the dialog rejects (BUG-1). The addresses are in the form the
  // app stores them, trimmed and lower-cased. The valid ones also stand in
  // src/features/licenses/licenses.schema.test.ts.
  const valid = [
    'vorname.nachname+kurs@example.com',
    'max-muster@example.com',
    'teilnehmer_1@mail.sub.example.com',
    "o'neil@example.com",
    `${'a'.repeat(242)}@example.com`,
  ]
  const invalid = [
    'teilnehmer.example.com',
    'teil@nehmer@example.com',
    '@example.com',
    'teilnehmer@example',
    'teil nehmer@example.com',
    'teil\u0007nehmer@example.com',
    `${'a'.repeat(243)}@example.com`,
    // The column accepted these until BUG-1.
    '<script>alert(1)</script>@example.com',
    '"><img/src=x/onerror=alert(1)>@example.com',
    'teilnehmer@example.c',
    'teilnehmer@example.123',
    '.teilnehmer@example.com',
    'teilnehmer.@example.com',
    'teil..nehmer@example.com',
    'teilnehmer@-example.com',
    'teilnehmer@example..com',
    'teilnehmer@example.com.',
    'teilnehmer@exa_mple.com',
    'müller@example.com',
  ]
  const ACCEPTED = 'accepted'

  it('nimmt mit dem Token des Verwalters genau die Adressen an, die das Schema der App annimmt (BUG-1)', async () => {
    expect(valid.at(-1)).toHaveLength(254)
    const a = await signedInAdmin()
    const addresses = [...valid, ...invalid]
    await setQuota(a.trainingProviderId, addresses.length)
    const expected = Object.fromEntries(
      addresses.map((email) => [email, valid.includes(email) ? ACCEPTED : CHECK_VIOLATION])
    )

    const app = Object.fromEntries(
      addresses.map((email) => [
        email,
        assignLicenseSchema.safeParse({ email }).success ? ACCEPTED : CHECK_VIOLATION,
      ])
    )
    const column: Record<string, string> = {}
    for (const email of addresses) {
      const { error } = await a.client
        .from('licenses')
        .insert({ training_provider_id: a.trainingProviderId, email })
      column[email] = error ? error.code : ACCEPTED
    }

    expect(app).toEqual(expected)
    expect(column).toEqual(expected)
    expect(await licenseEmailsOf(a.trainingProviderId)).toEqual([...valid].sort())
  })

  it.each([
    ['mit Großbuchstaben', 'Teilnehmer@example.com'],
    ['mit Leerzeichen am Rand', ' teilnehmer@example.com'],
  ])('lehnt eine Adresse %s ab, statt sie anzupassen', async (_case, email) => {
    const b = await otherTrainingProvider()

    const { error } = await createAdminTestClient()
      .from('licenses')
      .insert({ training_provider_id: b.trainingProviderId, email })

    expect(error?.code).toBe(CHECK_VIOLATION)
    expect(await licenseEmailsOf(b.trainingProviderId)).toEqual([])
  })
})

describe('Zugriffsregeln (AC-10)', { timeout: TIMEOUT }, () => {
  it('A liest nur die Lizenzen von A, nie eine von B', async () => {
    const a = await signedInAdmin()
    const b = await otherTrainingProvider()
    const emailA = participant('a')
    const [licenseB] = await assignAsAdmin(b.trainingProviderId, [participant('b')])
    await assignAsAdmin(a.trainingProviderId, [emailA])

    const all = await a.client.from('licenses').select('training_provider_id, email')
    expect(all.error).toBeNull()
    expect(all.data).toEqual([{ training_provider_id: a.trainingProviderId, email: emailA }])

    const byId = await a.client.from('licenses').select('id').eq('id', licenseB.id)
    expect(byId.data).toEqual([])
  })

  it('eine Anlage für B endet immer mit 42501, auch wenn die Adresse dort schon vergeben oder das Kontingent voll ist', async () => {
    const a = await signedInAdmin()
    const b = await otherTrainingProvider()
    const emailB = participant('b')
    await setQuota(b.trainingProviderId, 1)
    await assignAsAdmin(b.trainingProviderId, [emailB])

    for (const email of [participant('neu'), emailB]) {
      const { error } = await a.client.from('licenses').insert({ training_provider_id: b.trainingProviderId, email })
      expect(error?.code).toBe(PERMISSION_DENIED)
      expect(error?.message).toBe('training_provider_not_accessible')
      expect(JSON.stringify(error)).not.toContain(email)
    }
    expect(await licenseEmailsOf(b.trainingProviderId)).toEqual([emailB])
  })

  it('A entzieht keine Lizenz von B, ändert keine Lizenz und setzt id oder assigned_at nicht selbst', async () => {
    const a = await signedInAdmin()
    const b = await otherTrainingProvider()
    const emailB = participant('b')
    const [licenseB] = await assignAsAdmin(b.trainingProviderId, [emailB])
    const [licenseA] = await assignAsAdmin(a.trainingProviderId, [participant('a')])

    const revoke = await a.client.from('licenses').delete().eq('id', licenseB.id).select('id')
    expect(revoke.error).toBeNull()
    expect(revoke.data).toEqual([])
    expect(await licenseEmailsOf(b.trainingProviderId)).toEqual([emailB])

    const update = await a.client.from('licenses').update({ email: participant('neu') }).eq('id', licenseA.id)
    expect(update.error?.code).toBe(PERMISSION_DENIED)

    const ownId = await a.client
      .from('licenses')
      .insert({ id: randomUUID(), training_provider_id: a.trainingProviderId, email: participant() })
    expect(ownId.error?.code).toBe(PERMISSION_DENIED)
    const ownTime = await a.client.from('licenses').insert({
      training_provider_id: a.trainingProviderId,
      email: participant(),
      assigned_at: '2020-01-01T00:00:00Z',
    })
    expect(ownTime.error?.code).toBe(PERMISSION_DENIED)

    expect(await licenseEmailsOf(a.trainingProviderId)).toHaveLength(1)
  })

  it('ein abgemeldeter Besucher bekommt keine Zeilen und darf nichts anlegen', async () => {
    const b = await otherTrainingProvider()
    await assignAsAdmin(b.trainingProviderId, [participant('b')])
    const anon = createAnonTestClient()

    const read = await anon.from('licenses').select('*')
    expect(read.data ?? []).toEqual([])
    expect(read.error?.code).toBe(PERMISSION_DENIED)

    const insert = await anon.from('licenses').insert({ training_provider_id: b.trainingProviderId, email: participant() })
    expect(insert.error?.code).toBe(PERMISSION_DENIED)
    expect(await licenseEmailsOf(b.trainingProviderId)).toHaveLength(1)
  })
})

describe('Keine Adresse bleibt zurück (AC-11)', { timeout: TIMEOUT }, () => {
  async function rowsWithEmail(email: string) {
    const { data, error } = await createAdminTestClient().from('licenses').select('id').eq('email', email)
    if (error) throw error
    return data
  }

  it('nach dem Entziehen ist die Adresse vollständig aus der Tabelle verschwunden', async () => {
    const a = await signedInAdmin()
    const email = participant()
    const [license] = await assignAsAdmin(a.trainingProviderId, [email])

    await a.client.from('licenses').delete().eq('id', license.id)

    expect(await rowsWithEmail(email)).toEqual([])
  })

  it('wird das Konto des Verwalters gelöscht, sind Träger und Lizenzen weg', async () => {
    const b = await otherTrainingProvider()
    const email = participant()
    await assignAsAdmin(b.trainingProviderId, [email])
    const admin = createAdminTestClient()

    const { error } = await admin.auth.admin.deleteUser(b.account.userId)
    expect(error).toBeNull()

    expect(await rowsWithEmail(email)).toEqual([])
    const providers = await admin.from('training_providers').select('id').eq('id', b.trainingProviderId)
    expect(providers.data).toEqual([])
  })
})
