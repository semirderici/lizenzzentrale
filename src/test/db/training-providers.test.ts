// @vitest-environment node
// Database tests for supabase/migrations/20261021120000_proj1_training_providers.sql,
// run against the hosted project with real test accounts.
import {
  createAdminTestClient,
  createAnonTestClient,
  createSignedInTestAccount,
  createTestAccount,
  createUserTestClient,
  deleteTestAccounts,
  isRegistered,
  registerForCleanup,
  uniqueEmail,
  uniquePassword,
} from '@/test/supabase'

const TIMEOUT = 60_000
const PERMISSION_DENIED = '42501'

async function trainingProviderIdOf(userId: string) {
  const { data, error } = await createAdminTestClient()
    .from('training_provider_members')
    .select('training_provider_id')
    .eq('user_id', userId)
    .single()
  if (error) throw error
  return data.training_provider_id as string
}

afterAll(async () => {
  await deleteTestAccounts()
}, TIMEOUT)

describe('Registrierung legt Träger und Mitgliedschaft an', { timeout: TIMEOUT }, () => {
  it('Kontingent ist 5 und die Rolle admin, auch wenn die Registrierungsdaten anderes mitschicken (AC-1)', async () => {
    const account = await createSignedInTestAccount({
      userMetadata: { training_provider_name: '  Akademie Nord  ', license_quota: 999, role: 'owner' },
    })
    const user = createUserTestClient(account.accessToken)

    const membership = await user
      .from('training_provider_members')
      .select('training_provider_id, user_id, role')
      .single()
    expect(membership.error).toBeNull()
    expect(membership.data).toMatchObject({ user_id: account.userId, role: 'admin' })

    const provider = await user.from('training_providers').select('id, name, license_quota').single()
    expect(provider.error).toBeNull()
    expect(provider.data).toEqual({
      id: membership.data!.training_provider_id,
      name: 'Akademie Nord',
      license_quota: 5,
    })
  })

  it('Namen mit 2 und mit 100 Zeichen (gezählt wie char_length, auch mit Umlauten) sind gültig (AC-2)', async () => {
    for (const name of ['AB', 'ä'.repeat(100)]) {
      const account = await createTestAccount({ userMetadata: { training_provider_name: name } })
      const provider = await createAdminTestClient()
        .from('training_providers')
        .select('name')
        .eq('id', await trainingProviderIdOf(account.userId))
        .single()
      expect(provider.data).toEqual({ name })
    }
  })

  it.each([
    ['ohne Namen', {}],
    ['nur Leerzeichen', { training_provider_name: '   ' }],
    ['1 Zeichen nach dem Kürzen', { training_provider_name: ' A ' }],
    ['101 Zeichen', { training_provider_name: 'ä'.repeat(101) }],
  ])('ein ungültiger Name (%s) legt nichts an (EC-3)', async (_case, userMetadata) => {
    const email = uniqueEmail('invalid-name')
    const password = uniquePassword()
    const { data, error } = await createAdminTestClient().auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: userMetadata,
    })
    if (data.user) registerForCleanup(data.user.id)

    expect(error).not.toBeNull()
    expect(data.user).toBeNull()
    expect(await isRegistered(email)).toBe(false)
  })
})

describe('Zugriffsregeln (AC-11)', { timeout: TIMEOUT }, () => {
  it('A sieht nur den eigenen Träger und die eigene Mitgliedschaft, nie eine Zeile von B', async () => {
    const a = await createSignedInTestAccount({ userMetadata: { training_provider_name: 'Träger A' } })
    const b = await createTestAccount({ userMetadata: { training_provider_name: 'Träger B' } })
    const providerIdA = await trainingProviderIdOf(a.userId)
    const providerIdB = await trainingProviderIdOf(b.userId)
    const userA = createUserTestClient(a.accessToken)

    const providers = await userA.from('training_providers').select('id, name')
    expect(providers.error).toBeNull()
    expect(providers.data).toEqual([{ id: providerIdA, name: 'Träger A' }])

    const memberships = await userA.from('training_provider_members').select('user_id')
    expect(memberships.data).toEqual([{ user_id: a.userId }])

    const providerB = await userA.from('training_providers').select('id').eq('id', providerIdB)
    expect(providerB.data).toEqual([])
    const membershipB = await userA.from('training_provider_members').select('user_id').eq('user_id', b.userId)
    expect(membershipB.data).toEqual([])
  })

  it('jeder Schreibversuch von A scheitert am fehlenden Recht, und nichts ändert sich', async () => {
    const a = await createSignedInTestAccount({ userMetadata: { training_provider_name: 'Träger A' } })
    const b = await createTestAccount({ userMetadata: { training_provider_name: 'Träger B' } })
    const providerIdA = await trainingProviderIdOf(a.userId)
    const providerIdB = await trainingProviderIdOf(b.userId)
    const userA = createUserTestClient(a.accessToken)

    const attempts = [
      await userA.from('training_providers').update({ license_quota: 50 }).eq('id', providerIdA),
      await userA.from('training_providers').update({ name: 'Umbenannt' }).eq('id', providerIdA),
      await userA.from('training_providers').insert({ name: 'Zweiter Träger' }),
      await userA.from('training_providers').delete().eq('id', providerIdA),
      await userA
        .from('training_provider_members')
        .insert({ training_provider_id: providerIdB, user_id: a.userId, role: 'admin' }),
      await userA
        .from('training_provider_members')
        .update({ training_provider_id: providerIdB })
        .eq('user_id', a.userId),
      await userA.from('training_provider_members').delete().eq('user_id', a.userId),
    ]
    for (const attempt of attempts) {
      expect(attempt.error?.code).toBe(PERMISSION_DENIED)
    }

    const admin = createAdminTestClient()
    const providerA = await admin
      .from('training_providers')
      .select('name, license_quota')
      .eq('id', providerIdA)
      .single()
    expect(providerA.data).toEqual({ name: 'Träger A', license_quota: 5 })
    const membershipsA = await admin
      .from('training_provider_members')
      .select('training_provider_id')
      .eq('user_id', a.userId)
    expect(membershipsA.data).toEqual([{ training_provider_id: providerIdA }])
    const membersB = await admin
      .from('training_provider_members')
      .select('user_id')
      .eq('training_provider_id', providerIdB)
    expect(membersB.data).toEqual([{ user_id: b.userId }])
  })

  it('ein abgemeldeter Besucher bekommt keine Zeilen und kann nichts schreiben', async () => {
    await createTestAccount()
    const anon = createAnonTestClient()

    for (const table of ['training_providers', 'training_provider_members']) {
      const read = await anon.from(table).select('*')
      expect(read.data ?? []).toEqual([])
      expect(read.error?.code).toBe(PERMISSION_DENIED)
    }
    const insert = await anon.from('training_providers').insert({ name: 'Fremder Träger' })
    expect(insert.error?.code).toBe(PERMISSION_DENIED)
  })
})

describe('Löschen durch den Anbieter', { timeout: TIMEOUT }, () => {
  it('wird das Konto gelöscht, sind Mitgliedschaft und Träger weg (AC-12)', async () => {
    const account = await createTestAccount()
    const providerId = await trainingProviderIdOf(account.userId)
    const admin = createAdminTestClient()

    const { error } = await admin.auth.admin.deleteUser(account.userId)
    expect(error).toBeNull()

    const memberships = await admin
      .from('training_provider_members')
      .select('user_id')
      .eq('user_id', account.userId)
    expect(memberships.data).toEqual([])
    const providers = await admin.from('training_providers').select('id').eq('id', providerId)
    expect(providers.data).toEqual([])
  })

  it('wird nur der Träger gelöscht, bleibt das Konto ohne Mitgliedschaft, und der Trigger verträgt das (EC-5)', async () => {
    const account = await createSignedInTestAccount()
    const providerId = await trainingProviderIdOf(account.userId)
    const admin = createAdminTestClient()

    const deletion = await admin.from('training_providers').delete().eq('id', providerId)
    expect(deletion.error).toBeNull()

    const user = await admin.auth.admin.getUserById(account.userId)
    expect(user.error).toBeNull()
    expect(user.data.user?.id).toBe(account.userId)

    const memberships = await createUserTestClient(account.accessToken)
      .from('training_provider_members')
      .select('user_id')
    expect(memberships.error).toBeNull()
    expect(memberships.data).toEqual([])
  })
})
