// @vitest-environment node
// Tests for the data access of an invitation with both Supabase clients replaced: which client is
// used, which parameters and filters go out, and how every answer is translated. The real
// behaviour of the database functions is covered by src/test/db/invitations.test.ts.
import { beginInvitation, finishInvitation, isLicenseVisible } from './invitations.data'

const TRAINING_PROVIDER_ID = '6f0c2f61-3a52-4c51-9d0a-2b7f4e1c9a11'
const LICENSE_ID = '0b9a7c3e-1d2f-4e5a-8b6c-7d8e9f0a1b2c'
const EMAIL = 'vorname.nachname+kurs@mail.sub.example.com'

type Answer = { data: unknown; error: unknown }

// What the mocked clients answer, chosen per test; `throws` makes the client itself fail.
const clients = vi.hoisted(() => ({
  server: { answer: { data: null, error: null } as Answer, throws: false },
  admin: { answer: { data: null, error: null } as Answer, throws: false },
}))

const query = {
  select: vi.fn(() => query),
  eq: vi.fn(() => query),
  maybeSingle: vi.fn(async () => clients.server.answer),
}
const from = vi.fn(() => query)
const rpc = vi.fn(async () => clients.admin.answer)
const createServerClient = vi.fn(async () => {
  if (clients.server.throws) throw new Error('Supabase is not reachable.')
  return { from, rpc: () => { throw new Error('The session client never calls the database functions.') } }
})
const createAdminClient = vi.fn(() => {
  if (clients.admin.throws) throw new Error('Supabase is not reachable.')
  return { rpc, from: () => { throw new Error('The admin client is used for the two functions only.') } }
})

vi.mock('@/lib/supabase/server', () => ({ createClient: () => createServerClient() }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => createAdminClient() }))

beforeEach(() => {
  vi.clearAllMocks()
  clients.server.answer = { data: null, error: null }
  clients.server.throws = false
  clients.admin.answer = { data: null, error: null }
  clients.admin.throws = false
})

describe('isLicenseVisible', () => {
  it('fragt mit der Sitzung nach genau dieser Lizenz dieses Trägers, nur nach der ID, nie mit dem Admin-Client', async () => {
    clients.server.answer = { data: { id: LICENSE_ID }, error: null }

    expect(await isLicenseVisible(TRAINING_PROVIDER_ID, LICENSE_ID)).toEqual({ status: 'visible' })

    expect(from).toHaveBeenCalledWith('licenses')
    expect(query.select).toHaveBeenCalledWith('id')
    expect(query.eq.mock.calls).toEqual([
      ['id', LICENSE_ID],
      ['training_provider_id', TRAINING_PROVIDER_ID],
    ])
    expect(query.maybeSingle).toHaveBeenCalledTimes(1)
    expect(createAdminClient).not.toHaveBeenCalled()
  })

  it('keine Zeile heißt „nicht sichtbar“: entzogen oder fremd (EC-5, AC-9)', async () => {
    clients.server.answer = { data: null, error: null }

    expect(await isLicenseVisible(TRAINING_PROVIDER_ID, LICENSE_ID)).toEqual({ status: 'not_visible' })
  })

  it('ein Datenbankfehler oder ein nicht erreichbares Supabase ist ein Fehler, nie „nicht sichtbar“', async () => {
    clients.server.answer = { data: null, error: { code: '57014', message: 'statement timeout' } }
    expect(await isLicenseVisible(TRAINING_PROVIDER_ID, LICENSE_ID)).toEqual({ status: 'error' })

    clients.server.throws = true
    expect(await isLicenseVisible(TRAINING_PROVIDER_ID, LICENSE_ID)).toEqual({ status: 'error' })
  })
})

describe('beginInvitation', () => {
  it('ruft die Beginn-Funktion mit dem Admin-Client und nur den beiden IDs auf (AC-9)', async () => {
    clients.admin.answer = { data: { status: 'already_sending' }, error: null }

    await beginInvitation(TRAINING_PROVIDER_ID, LICENSE_ID)

    expect(rpc).toHaveBeenCalledTimes(1)
    expect(rpc).toHaveBeenCalledWith('license_center_begin_invitation', {
      p_training_provider_id: TRAINING_PROVIDER_ID,
      p_license_id: LICENSE_ID,
    })
    expect(createServerClient).not.toHaveBeenCalled()
  })

  it('„erlaubt“ liefert Versand-ID und die Adresse unverändert (EC-8)', async () => {
    clients.admin.answer = { data: { status: 'allowed', send_id: 42, email: EMAIL }, error: null }

    expect(await beginInvitation(TRAINING_PROVIDER_ID, LICENSE_ID)).toEqual({
      status: 'allowed',
      sendId: 42,
      email: EMAIL,
    })
  })

  it.each([
    [{ status: 'license_not_found' }, { status: 'not_found' }],
    [{ status: 'already_sending' }, { status: 'already_sending' }],
    [
      { status: 'license_limit', available_from: '2026-10-28T13:11:56.123456+00:00' },
      { status: 'license_limit', availableFrom: '2026-10-28T13:11:56.123Z' },
    ],
    [
      { status: 'provider_limit', available_from: '2026-10-28T14:00:00+01:00' },
      { status: 'provider_limit', availableFrom: '2026-10-28T13:00:00.000Z' },
    ],
  ])('übersetzt %j in %j (EC-1, EC-5, AC-7, AC-8)', async (data, expected) => {
    clients.admin.answer = { data, error: null }

    // Strict: an extra key, even one that is undefined, is a different result.
    expect(await beginInvitation(TRAINING_PROVIDER_ID, LICENSE_ID)).toStrictEqual(expected)
  })

  it.each([
    ['einen Datenbankfehler', { data: null, error: { code: '42501', message: 'permission denied' } }],
    ['keine Antwort', { data: null, error: null }],
    ['einen unbekannten Status', { data: { status: 'sent' }, error: null }],
    ['„erlaubt“ ohne Adresse', { data: { status: 'allowed', send_id: 42 }, error: null }],
    ['„erlaubt“ ohne Versand-ID', { data: { status: 'allowed', email: EMAIL }, error: null }],
    ['eine Grenze ohne Zeitpunkt', { data: { status: 'license_limit' }, error: null }],
    ['eine Grenze mit unlesbarem Zeitpunkt', { data: { status: 'provider_limit', available_from: 'morgen' }, error: null }],
  ])('macht aus %s einen Fehler, nie „erlaubt“', async (_case, answer) => {
    clients.admin.answer = answer as Answer

    expect(await beginInvitation(TRAINING_PROVIDER_ID, LICENSE_ID)).toEqual({ status: 'error' })
  })

  it('ist Supabase nicht erreichbar, ist das ein Fehler', async () => {
    clients.admin.throws = true

    expect(await beginInvitation(TRAINING_PROVIDER_ID, LICENSE_ID)).toEqual({ status: 'error' })
  })

  it('schreibt nichts auf die Konsole, auch nicht im Fehlerfall', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {})

    clients.admin.answer = { data: { status: 'allowed', send_id: 42, email: EMAIL }, error: null }
    await beginInvitation(TRAINING_PROVIDER_ID, LICENSE_ID)
    clients.admin.answer = { data: { status: 'allowed', send_id: 'x', email: EMAIL }, error: null }
    await beginInvitation(TRAINING_PROVIDER_ID, LICENSE_ID)

    expect(consoleError).not.toHaveBeenCalled()
    expect(consoleLog).not.toHaveBeenCalled()
    consoleError.mockRestore()
    consoleLog.mockRestore()
  })
})

describe('finishInvitation', () => {
  it.each([true, false])('ruft die Abschluss-Funktion mit dem Admin-Client auf (angenommen: %s)', async (accepted) => {
    expect(await finishInvitation(42, accepted)).toBe(true)

    expect(rpc).toHaveBeenCalledWith('license_center_finish_invitation', { p_send_id: 42, p_accepted: accepted })
    expect(createServerClient).not.toHaveBeenCalled()
  })

  it('meldet false bei einem Datenbankfehler oder nicht erreichbarem Supabase', async () => {
    clients.admin.answer = { data: null, error: { code: '22004', message: 'send and answer are required' } }
    expect(await finishInvitation(42, true)).toBe(false)

    clients.admin.throws = true
    expect(await finishInvitation(42, true)).toBe(false)
  })
})
