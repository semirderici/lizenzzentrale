// @vitest-environment node
// Database tests for supabase/migrations/20261026150000_proj3_license_invitations.sql, run against
// the hosted project with real test accounts. The functions are called the way the app calls
// them: through the admin client. No mail is sent; participant addresses come from example.com.
// What the data API cannot reach (the schema private) is checked by /build per SQL.
import { randomUUID } from 'node:crypto'
import {
  createAdminTestClient,
  createAnonTestClient,
  createSignedInTestAccount,
  createTestAccount,
  createUserTestClient,
  deleteTestAccounts,
} from '@/test/supabase'

const TIMEOUT = 120_000
const PERMISSION_DENIED = '42501'
const DAY = 24 * 60 * 60 * 1000

type BeginResult =
  | { status: 'allowed'; send_id: number; email: string }
  | { status: 'license_not_found' }
  | { status: 'already_sending' }
  | { status: 'license_limit' | 'provider_limit'; available_from: string }

type Invitation = {
  license_id: string
  training_provider_id: string
  status: 'sending' | 'sent' | 'failed'
  last_attempt_at: string
}

const admin = createAdminTestClient()

/** A participant address that no other test uses. */
function participant(label = 'teilnehmer') {
  return `${label}-${randomUUID()}@example.com`
}

async function trainingProviderIdOf(userId: string) {
  const { data, error } = await admin
    .from('training_provider_members')
    .select('training_provider_id')
    .eq('user_id', userId)
    .single()
  if (error) throw error
  return data.training_provider_id as string
}

/** The provider's change in the Supabase table view. */
async function setQuota(trainingProviderId: string, licenseQuota: number) {
  const { error } = await admin
    .from('training_providers')
    .update({ license_quota: licenseQuota })
    .eq('id', trainingProviderId)
  if (error) throw error
}

/** Assigns through service_role: no RLS, but the trigger still checks quota and duplicates. */
async function assignAsAdmin(trainingProviderId: string, emails: string[]) {
  const { data, error } = await admin
    .from('licenses')
    .insert(emails.map((email) => ({ training_provider_id: trainingProviderId, email })))
    .select('id, email')
  if (error) throw error
  return data as { id: string; email: string }[]
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

/** A training provider whose administrator never signs in. */
async function otherTrainingProvider(name = 'Träger B') {
  const account = await createTestAccount({ userMetadata: { training_provider_name: name } })
  return { account, trainingProviderId: await trainingProviderIdOf(account.userId) }
}

async function begin(trainingProviderId: string, licenseId: string) {
  const { data, error } = await admin.rpc('license_center_begin_invitation', {
    p_training_provider_id: trainingProviderId,
    p_license_id: licenseId,
  })
  if (error) throw error
  return data as BeginResult
}

async function finish(sendId: number, accepted: boolean) {
  const { error } = await admin.rpc('license_center_finish_invitation', {
    p_send_id: sendId,
    p_accepted: accepted,
  })
  if (error) throw error
}

async function allowed(trainingProviderId: string, licenseId: string) {
  const result = await begin(trainingProviderId, licenseId)
  expect(result.status).toBe('allowed')
  return result as Extract<BeginResult, { status: 'allowed' }>
}

async function invitationOf(licenseId: string) {
  const { data, error } = await admin
    .from('license_invitations')
    .select('*')
    .eq('license_id', licenseId)
    .maybeSingle()
  if (error) throw error
  return data as Invitation | null
}

/**
 * Sends that the e-mail service accepted, `perLicense` per licence, the licences side by side.
 * Returns the start of every send: under the lock the invitation shows exactly that attempt.
 */
async function acceptedSends(trainingProviderId: string, licenseIds: string[], perLicense: number[]) {
  const startedAt: number[] = []
  await Promise.all(
    licenseIds.map(async (licenseId, index) => {
      for (let i = 0; i < perLicense[index]; i++) {
        const { send_id } = await allowed(trainingProviderId, licenseId)
        startedAt.push(Date.parse((await invitationOf(licenseId))!.last_attempt_at))
        await finish(send_id, true)
      }
    })
  )
  return startedAt.sort((a, b) => a - b)
}

function expectLimit(result: BeginResult, status: 'license_limit' | 'provider_limit', availableFrom: number) {
  expect(result.status).toBe(status)
  expect(Date.parse((result as { available_from: string }).available_from)).toBe(availableFrom)
}

afterAll(async () => {
  await deleteTestAccounts()
}, TIMEOUT)

describe('Zugriffsregeln (AC-9)', { timeout: TIMEOUT }, () => {
  it('A liest nur die Versandstände von A; anlegen, ändern und löschen werden abgelehnt, ohne Adresse im Fehler', async () => {
    const a = await signedInAdmin()
    const b = await otherTrainingProvider()
    const emailA = participant('a')
    const [invitedA, freshA] = await assignAsAdmin(a.trainingProviderId, [emailA, participant('a')])
    const [licenseB] = await assignAsAdmin(b.trainingProviderId, [participant('b')])
    await allowed(a.trainingProviderId, invitedA.id)
    await allowed(b.trainingProviderId, licenseB.id)
    const before = await invitationOf(invitedA.id)

    const read = await a.client.from('license_invitations').select('license_id, training_provider_id')
    expect(read.error).toBeNull()
    expect(read.data).toEqual([{ license_id: invitedA.id, training_provider_id: a.trainingProviderId }])

    const insert = await a.client.from('license_invitations').insert({
      license_id: freshA.id,
      training_provider_id: a.trainingProviderId,
      status: 'sent',
      last_attempt_at: new Date().toISOString(),
    })
    const update = await a.client.from('license_invitations').update({ status: 'failed' }).eq('license_id', invitedA.id)
    const remove = await a.client.from('license_invitations').delete().eq('license_id', invitedA.id)
    for (const { error } of [insert, update, remove]) {
      expect(error?.code).toBe(PERMISSION_DENIED)
      expect(JSON.stringify(error)).not.toContain(emailA)
    }

    expect(await invitationOf(invitedA.id)).toEqual(before)
    expect(await invitationOf(freshA.id)).toBeNull()
  })

  it('ein abgemeldeter Besucher bekommt keine Zeilen', async () => {
    const b = await otherTrainingProvider()
    const [licenseB] = await assignAsAdmin(b.trainingProviderId, [participant('b')])
    await allowed(b.trainingProviderId, licenseB.id)

    const read = await createAnonTestClient().from('license_invitations').select('*')
    expect(read.data ?? []).toEqual([])
    expect(read.error?.code).toBe(PERMISSION_DENIED)
  })

  it('beide Funktionen sind mit dem Token von A und mit dem öffentlichen Schlüssel nicht aufrufbar', async () => {
    const a = await signedInAdmin()
    const [license] = await assignAsAdmin(a.trainingProviderId, [participant()])
    const clients = { anon: createAnonTestClient(), authenticated: a.client }
    const calls: Array<[string, Record<string, unknown>]> = [
      ['license_center_begin_invitation', { p_training_provider_id: a.trainingProviderId, p_license_id: license.id }],
      ['license_center_finish_invitation', { p_send_id: 1, p_accepted: false }],
    ]

    for (const [role, client] of Object.entries(clients)) {
      for (const [fn, args] of calls) {
        const { error } = await client.rpc(fn, args)
        expect({ role, fn, code: error?.code }).toEqual({ role, fn, code: PERMISSION_DENIED })
      }
    }
    expect(await invitationOf(license.id)).toBeNull()
  })
})

describe('Beginn', { timeout: TIMEOUT }, () => {
  it('eine Lizenz von B mit der Träger-ID von A und eine unbekannte ID enden mit license_not_found, ohne etwas anzulegen', async () => {
    const a = await otherTrainingProvider('Träger A')
    const b = await otherTrainingProvider()
    const emailB = participant('b')
    const [licenseB] = await assignAsAdmin(b.trainingProviderId, [emailB])

    for (const licenseId of [licenseB.id, randomUUID()]) {
      const result = await begin(a.trainingProviderId, licenseId)
      expect(result).toEqual({ status: 'license_not_found' })
    }
    expect(await invitationOf(licenseB.id)).toBeNull()
  })

  it('allowed liefert die Adresse genau so, wie sie gespeichert ist, und der Versandstand hat genau vier Felder (EC-8, AC-12)', async () => {
    const b = await otherTrainingProvider()
    const email = `vorname.nachname+kurs-${randomUUID()}@mail.sub.example.com`
    const [license] = await assignAsAdmin(b.trainingProviderId, [email])
    const before = Date.now()

    const result = await allowed(b.trainingProviderId, license.id)

    expect(result.email).toBe(email)
    expect(typeof result.send_id).toBe('number')
    const invitation = await invitationOf(license.id)
    expect(Object.keys(invitation!).sort()).toEqual(['last_attempt_at', 'license_id', 'status', 'training_provider_id'])
    expect(invitation).toMatchObject({ training_provider_id: b.trainingProviderId, status: 'sending' })
    expect(Math.abs(Date.parse(invitation!.last_attempt_at) - before)).toBeLessThan(30_000)
    expect(JSON.stringify(invitation)).not.toContain(email)
  })

  it('ein zweiter Beginn, solange der erste weniger als 2 Minuten läuft, endet mit already_sending, der Stand bleibt (EC-1)', async () => {
    const b = await otherTrainingProvider()
    const [license] = await assignAsAdmin(b.trainingProviderId, [participant()])
    await allowed(b.trainingProviderId, license.id)
    const before = await invitationOf(license.id)

    expect(await begin(b.trainingProviderId, license.id)).toEqual({ status: 'already_sending' })
    expect(await invitationOf(license.id)).toEqual(before)
  })

  it('ein Versand, der seit 3 Minuten hängt, hindert einen neuen Beginn nicht (EC-3)', async () => {
    const b = await otherTrainingProvider()
    const [license] = await assignAsAdmin(b.trainingProviderId, [participant()])
    await allowed(b.trainingProviderId, license.id)
    const threeMinutesAgo = new Date(Date.now() - 3 * 60 * 1000).toISOString()
    const { error } = await admin
      .from('license_invitations')
      .update({ last_attempt_at: threeMinutesAgo })
      .eq('license_id', license.id)
    if (error) throw error

    await allowed(b.trainingProviderId, license.id)

    const invitation = await invitationOf(license.id)
    expect(invitation!.status).toBe('sending')
    expect(Date.parse(invitation!.last_attempt_at)).toBeGreaterThan(Date.parse(threeMinutesAgo))
  })
})

describe('Abschluss', { timeout: TIMEOUT }, () => {
  it('angenommen setzt sent, nicht angenommen failed; der Zeitpunkt bleibt der Beginn, ein zweiter Abschluss ändert nichts', async () => {
    const b = await otherTrainingProvider()
    const [accepted, rejected] = await assignAsAdmin(b.trainingProviderId, [participant(), participant()])
    const sendAccepted = await allowed(b.trainingProviderId, accepted.id)
    const sendRejected = await allowed(b.trainingProviderId, rejected.id)
    const startedAccepted = (await invitationOf(accepted.id))!.last_attempt_at
    const startedRejected = (await invitationOf(rejected.id))!.last_attempt_at

    await finish(sendAccepted.send_id, true)
    await finish(sendRejected.send_id, false)

    expect(await invitationOf(accepted.id)).toMatchObject({ status: 'sent', last_attempt_at: startedAccepted })
    expect(await invitationOf(rejected.id)).toMatchObject({ status: 'failed', last_attempt_at: startedRejected })

    await finish(sendAccepted.send_id, false)
    await finish(sendRejected.send_id, true)
    expect((await invitationOf(accepted.id))!.status).toBe('sent')
    expect((await invitationOf(rejected.id))!.status).toBe('failed')
  })

  it('der späte Abschluss eines älteren Versuchs überschreibt den Stand eines neueren nicht (EC-3, EC-4)', async () => {
    const b = await otherTrainingProvider()
    const [license] = await assignAsAdmin(b.trainingProviderId, [participant()])
    const older = await allowed(b.trainingProviderId, license.id)
    const { error } = await admin
      .from('license_invitations')
      .update({ last_attempt_at: new Date(Date.now() - 3 * 60 * 1000).toISOString() })
      .eq('license_id', license.id)
    if (error) throw error
    const newer = await allowed(b.trainingProviderId, license.id)
    const startedNewer = (await invitationOf(license.id))!.last_attempt_at

    await finish(older.send_id, true)
    expect(await invitationOf(license.id)).toMatchObject({ status: 'sending', last_attempt_at: startedNewer })

    await finish(newer.send_id, false)
    expect(await invitationOf(license.id)).toMatchObject({ status: 'failed', last_attempt_at: startedNewer })
  })

  it('ein Abschluss nach dem Entziehen läuft ohne Fehler und lässt nichts zurück (EC-5)', async () => {
    const a = await signedInAdmin()
    const [license] = await assignAsAdmin(a.trainingProviderId, [participant()])
    const send = await allowed(a.trainingProviderId, license.id)

    const revoked = await a.client.from('licenses').delete().eq('id', license.id).select('id')
    expect(revoked.data).toEqual([{ id: license.id }])

    await finish(send.send_id, true)
    expect(await invitationOf(license.id)).toBeNull()
  })
})

describe('Grenze der Lizenz (AC-7)', { timeout: TIMEOUT }, () => {
  it('nach drei angenommenen Versendungen endet der vierte Beginn mit license_limit, ab der ältesten plus 24 Stunden; abgelehnte zählen nicht', async () => {
    const b = await otherTrainingProvider()
    const [license] = await assignAsAdmin(b.trainingProviderId, [participant()])
    const failed = await allowed(b.trainingProviderId, license.id)
    await finish(failed.send_id, false)

    const startedAt = await acceptedSends(b.trainingProviderId, [license.id], [3])
    const before = await invitationOf(license.id)

    expectLimit(await begin(b.trainingProviderId, license.id), 'license_limit', startedAt[0] + DAY)
    expect(await invitationOf(license.id)).toEqual(before)
  })

  it('eine neue Lizenz mit derselben Adresse beginnt bei null (EC-6)', async () => {
    const a = await signedInAdmin()
    const email = participant()
    const [license] = await assignAsAdmin(a.trainingProviderId, [email])
    await acceptedSends(a.trainingProviderId, [license.id], [3])
    expect((await begin(a.trainingProviderId, license.id)).status).toBe('license_limit')

    await a.client.from('licenses').delete().eq('id', license.id)
    const [reassigned] = await assignAsAdmin(a.trainingProviderId, [email])

    await allowed(a.trainingProviderId, reassigned.id)
  })
})

describe('Grenze des Trägers (AC-8, EC-6)', { timeout: TIMEOUT }, () => {
  it('nach 30 angenommenen Versendungen endet der nächste Beginn mit provider_limit, ohne Versandstand, auch nach dem Entziehen', async () => {
    const a = await signedInAdmin()
    await setQuota(a.trainingProviderId, 11)
    const licenses = await assignAsAdmin(
      a.trainingProviderId,
      Array.from({ length: 11 }, () => participant())
    )
    const sent = licenses.slice(0, 10)
    const next = licenses[10]

    const startedAt = await acceptedSends(a.trainingProviderId, sent.map((l) => l.id), Array(10).fill(3))
    expect(startedAt).toHaveLength(30)

    expectLimit(await begin(a.trainingProviderId, next.id), 'provider_limit', startedAt[0] + DAY)
    expect(await invitationOf(next.id)).toBeNull()

    // The sends of revoked licences keep counting for the training provider.
    const revoked = await a.client.from('licenses').delete().in('id', sent.map((l) => l.id)).select('id')
    expect(revoked.data).toHaveLength(10)
    expectLimit(await begin(a.trainingProviderId, next.id), 'provider_limit', startedAt[0] + DAY)
    expect(await invitationOf(next.id)).toBeNull()
  })
})

describe('Kontingent (EC-12)', { timeout: TIMEOUT }, () => {
  it('bei ausgeschöpftem oder unter die Zahl der Lizenzen gesenktem Kontingent ist ein Beginn erlaubt', async () => {
    const b = await otherTrainingProvider()
    await setQuota(b.trainingProviderId, 2)
    const [first, second] = await assignAsAdmin(b.trainingProviderId, [participant(), participant()])

    await allowed(b.trainingProviderId, first.id)
    await setQuota(b.trainingProviderId, 0)
    await allowed(b.trainingProviderId, second.id)
  })
})

describe('Gleichzeitige Anfragen', { timeout: TIMEOUT }, () => {
  it('drei gleichzeitige Beginn-Aufrufe für dieselbe Lizenz: genau einer ist erlaubt (EC-1)', async () => {
    const b = await otherTrainingProvider()
    const [license] = await assignAsAdmin(b.trainingProviderId, [participant()])

    const results = await Promise.all(Array.from({ length: 3 }, () => begin(b.trainingProviderId, license.id)))

    expect(results.map((r) => r.status).sort()).toEqual(['allowed', 'already_sending', 'already_sending'])
  })

  it('bei 29 angenommenen Versendungen: von zwei gleichzeitigen Aufrufen für verschiedene Lizenzen ist genau einer erlaubt (EC-2)', async () => {
    const b = await otherTrainingProvider()
    await setQuota(b.trainingProviderId, 12)
    const licenses = await assignAsAdmin(
      b.trainingProviderId,
      Array.from({ length: 12 }, () => participant())
    )
    await acceptedSends(
      b.trainingProviderId,
      licenses.slice(0, 10).map((l) => l.id),
      [3, 3, 3, 3, 3, 3, 3, 3, 3, 2]
    )

    const results = await Promise.all(licenses.slice(10).map((l) => begin(b.trainingProviderId, l.id)))

    expect(results.map((r) => r.status).sort()).toEqual(['allowed', 'provider_limit'])
  })
})

describe('Löschen (AC-12, EC-5)', { timeout: TIMEOUT }, () => {
  it('entzieht A eine Lizenz mit eigenem Token, ist ihr Versandstand weg, obwohl A kein Recht auf die Tabelle hat', async () => {
    const a = await signedInAdmin()
    const [license] = await assignAsAdmin(a.trainingProviderId, [participant()])
    const send = await allowed(a.trainingProviderId, license.id)
    await finish(send.send_id, true)

    const revoked = await a.client.from('licenses').delete().eq('id', license.id).select('id')
    expect(revoked.error).toBeNull()
    expect(revoked.data).toEqual([{ id: license.id }])

    expect(await invitationOf(license.id)).toBeNull()
  })

  it('wird das Konto von A gelöscht, sind dessen Versandstände weg, die von B bleiben', async () => {
    const a = await otherTrainingProvider('Träger A')
    const b = await otherTrainingProvider()
    const [licenseA] = await assignAsAdmin(a.trainingProviderId, [participant('a')])
    const [licenseB] = await assignAsAdmin(b.trainingProviderId, [participant('b')])
    await finish((await allowed(a.trainingProviderId, licenseA.id)).send_id, true)
    await allowed(b.trainingProviderId, licenseB.id)

    const { error } = await admin.auth.admin.deleteUser(a.account.userId)
    expect(error).toBeNull()

    expect(await invitationOf(licenseA.id)).toBeNull()
    expect(await invitationOf(licenseB.id)).not.toBeNull()
  })
})

describe('Einbetten in die Lizenzliste (für T13)', { timeout: TIMEOUT }, () => {
  it('mit dem Token von A liefert licenses pro Lizenz ein Objekt oder nichts, nie eines von B', async () => {
    const a = await signedInAdmin()
    const b = await otherTrainingProvider()
    const [invited, fresh] = await assignAsAdmin(a.trainingProviderId, [participant('a'), participant('a')])
    const [licenseB] = await assignAsAdmin(b.trainingProviderId, [participant('b')])
    await finish((await allowed(a.trainingProviderId, invited.id)).send_id, true)
    await allowed(b.trainingProviderId, licenseB.id)
    const invitation = await invitationOf(invited.id)

    const { data, error } = await a.client
      .from('licenses')
      .select('id, license_invitations(status, last_attempt_at)')
      .order('assigned_at')

    expect(error).toBeNull()
    expect(data).toHaveLength(2)
    const byId = Object.fromEntries(data!.map((row) => [row.id, row.license_invitations]))
    expect(byId).toEqual({
      [invited.id]: { status: 'sent', last_attempt_at: invitation!.last_attempt_at },
      [fresh.id]: null,
    })
  })
})
