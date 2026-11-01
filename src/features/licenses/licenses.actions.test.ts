// @vitest-environment node
// The guard, the data module, the sending of the invitation (PROJ-3) and refresh() are replaced,
// so each test sees exactly which steps a request reaches (design.md → Zuweisen, Entziehen).
// Schema and rules are the real ones.
import { refresh } from 'next/cache'
import { requireTrainingProvider } from '@/features/account/session.data'
import { deliverInvitation } from '@/features/invitations/invitations.delivery'
import type { DeliveryOutcome } from '@/features/invitations/invitations.rules'
import { assignLicense, revokeLicense } from './licenses.actions'
import { deleteLicense, insertLicense } from './licenses.data'

vi.mock('next/cache', () => ({ refresh: vi.fn() }))
vi.mock('@/features/account/session.data', () => ({ requireTrainingProvider: vi.fn() }))
vi.mock('./licenses.data', () => ({ insertLicense: vi.fn(), deleteLicense: vi.fn() }))
vi.mock('@/features/invitations/invitations.delivery', () => ({ deliverInvitation: vi.fn() }))

const TEXT = {
  emailRequired: 'Bitte geben Sie die E-Mail-Adresse des Teilnehmers ein.',
  emailInvalid: 'Bitte geben Sie eine gültige E-Mail-Adresse ein.',
  alreadyAssigned: 'Diese E-Mail-Adresse hat bereits eine Lizenz.',
}

const PROVIDER_ID = '0b6f2f7e-8a41-4d5c-9c1e-2a7d3b4c5e6f'
const FOREIGN_PROVIDER_ID = '7c1d9e2a-3b4f-4a6c-8d7e-9f0a1b2c3d4e'
const LICENSE_ID = '3f2b8c1e-5d4a-4c7b-9e2f-1a2b3c4d5e6f'

const assigned = {
  status: 'assigned' as const,
  userId: 'user-1',
  role: 'admin' as const,
  trainingProvider: { id: PROVIDER_ID, name: 'Akademie Nord', licenseQuota: 5 },
}

beforeEach(() => {
  vi.mocked(requireTrainingProvider).mockResolvedValue(assigned)
  vi.mocked(insertLicense).mockResolvedValue({ status: 'created', id: LICENSE_ID })
  vi.mocked(deleteLicense).mockResolvedValue({ status: 'revoked' })
  vi.mocked(deliverInvitation).mockResolvedValue({ status: 'sent' })
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('assignLicense', () => {
  it('legt die Lizenz für den Träger aus dem Wächter an, frischt die Seite auf und meldet „zugewiesen“ (AC-4)', async () => {
    expect(await assignLicense({ email: 'teilnehmer@example.com' })).toEqual({
      status: 'assigned',
      invitation: { status: 'sent' },
    })
    expect(insertLicense).toHaveBeenCalledWith(PROVIDER_ID, 'teilnehmer@example.com')
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('gibt die Adresse ohne Rand-Leerzeichen und kleingeschrieben weiter (AC-6)', async () => {
    await assignLicense({ email: ' Teilnehmer@Example.COM ' })
    expect(insertLicense).toHaveBeenCalledWith(PROVIDER_ID, 'teilnehmer@example.com')
  })

  it('ignoriert einen mitgeschickten Träger und nimmt immer den aus dem Wächter (AC-10)', async () => {
    await assignLicense({
      email: 'teilnehmer@example.com',
      trainingProviderId: FOREIGN_PROVIDER_ID,
      training_provider_id: FOREIGN_PROVIDER_ID,
    })
    expect(insertLicense).toHaveBeenCalledWith(PROVIDER_ID, 'teilnehmer@example.com')
  })

  it('weist die eigene Adresse des Verwalters wie jede andere zu (EC-9)', async () => {
    expect(await assignLicense({ email: 'verwalter@akademie-nord.de' })).toEqual({
      status: 'assigned',
      invitation: { status: 'sent' },
    })
    expect(insertLicense).toHaveBeenCalledWith(PROVIDER_ID, 'verwalter@akademie-nord.de')
  })

  it.each([
    ['leer', '', TEXT.emailRequired],
    ['nur Leerzeichen', '   ', TEXT.emailRequired],
    ['ohne @', 'teilnehmer.example.com', TEXT.emailInvalid],
    ['länger als 254 Zeichen', `${'a'.repeat(243)}@example.com`, TEXT.emailInvalid],
    ['länger als 1.000 Zeichen', 'a'.repeat(1001), TEXT.emailInvalid],
  ])('eine Adresse %s am Formular vorbei: Feldfehler, nichts wird angelegt (AC-5)', async (_case, email, message) => {
    expect(await assignLicense({ email })).toEqual({ status: 'field_error', message })
    expect(insertLicense).not.toHaveBeenCalled()
    expect(refresh).not.toHaveBeenCalled()
  })

  it('ohne Feld für die Adresse: Feldfehler „leer“ (AC-5)', async () => {
    expect(await assignLicense({})).toEqual({ status: 'field_error', message: TEXT.emailRequired })
    expect(insertLicense).not.toHaveBeenCalled()
  })

  it.each([
    ['null', null],
    ['Zeichenkette', 'teilnehmer@example.com'],
    ['Liste', ['teilnehmer@example.com']],
  ])('eine Eingabe, die kein Objekt ist (%s), endet mit „Fehler“', async (_case, input) => {
    expect(await assignLicense(input)).toEqual({ status: 'failed' })
    expect(insertLicense).not.toHaveBeenCalled()
  })

  it('schon vergeben: Seite auffrischen, Feldfehler aus AC-6 (AC-6, EC-2)', async () => {
    vi.mocked(insertLicense).mockResolvedValue({ status: 'already_assigned' })
    expect(await assignLicense({ email: 'teilnehmer@example.com' })).toEqual({
      status: 'field_error',
      message: TEXT.alreadyAssigned,
    })
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('ausgeschöpft: Seite auffrischen, Ergebnis „ausgeschöpft“ (AC-7, EC-1, EC-10)', async () => {
    vi.mocked(insertLicense).mockResolvedValue({ status: 'exhausted' })
    expect(await assignLicense({ email: 'teilnehmer@example.com' })).toEqual({ status: 'exhausted' })
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('Fehler der Datenbank: Ergebnis „Fehler“, ohne Auffrischen (EC-5)', async () => {
    vi.mocked(insertLicense).mockResolvedValue({ status: 'failed' })
    expect(await assignLicense({ email: 'teilnehmer@example.com' })).toEqual({ status: 'failed' })
    expect(refresh).not.toHaveBeenCalled()
  })

  it('nicht zugeordnet: Ergebnis „nicht zugeordnet“, ohne etwas zu lesen oder zu schreiben (EC-7)', async () => {
    vi.mocked(requireTrainingProvider).mockResolvedValue({ status: 'unassigned', userId: 'user-1' })
    expect(await assignLicense({ email: 'teilnehmer@example.com' })).toEqual({ status: 'unassigned' })
    expect(insertLicense).not.toHaveBeenCalled()
    expect(refresh).not.toHaveBeenCalled()
  })

  it('abgemeldet: die Weiterleitung des Wächters geht durch, nichts wird angelegt (EC-7)', async () => {
    vi.mocked(requireTrainingProvider).mockRejectedValue(new Error('NEXT_REDIRECT /login?reason=session'))
    await expect(assignLicense({ email: 'teilnehmer@example.com' })).rejects.toThrow(
      'NEXT_REDIRECT /login?reason=session'
    )
    expect(insertLicense).not.toHaveBeenCalled()
    expect(refresh).not.toHaveBeenCalled()
  })
})

describe('assignLicense versendet die Einladung (PROJ-3)', () => {
  it('versendet für die neue Lizenz mit dem Träger aus dem Wächter, vor dem Auffrischen (AC-1)', async () => {
    await assignLicense({ email: 'teilnehmer@example.com', trainingProviderId: FOREIGN_PROVIDER_ID })

    expect(deliverInvitation).toHaveBeenCalledTimes(1)
    // Only id and name: the quota plays no role in sending, and nothing comes from the input.
    expect(deliverInvitation).toHaveBeenCalledWith({ id: PROVIDER_ID, name: 'Akademie Nord' }, LICENSE_ID)
    expect(refresh).toHaveBeenCalledTimes(1)
    expect(vi.mocked(deliverInvitation).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(refresh).mock.invocationCallOrder[0]
    )
  })

  it.each<DeliveryOutcome>([
    { status: 'sent' },
    { status: 'failed' },
    { status: 'provider_limit', availableFrom: '2026-10-28T13:11:56.123Z' },
    { status: 'license_limit', availableFrom: '2026-10-28T13:11:56.123Z' },
    { status: 'already_sending' },
    { status: 'not_found' },
  ])('gibt den Versandausgang %j unverändert weiter, das Ergebnis bleibt „zugewiesen“ (AC-1, AC-3, AC-8, EC-6, EC-9)', async (outcome) => {
    vi.mocked(deliverInvitation).mockResolvedValue(outcome)

    expect(await assignLicense({ email: 'teilnehmer@example.com' })).toStrictEqual({
      status: 'assigned',
      invitation: outcome,
    })
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['schon vergeben', { status: 'already_assigned' } as const],
    ['ausgeschöpft', { status: 'exhausted' } as const],
    ['Fehler der Datenbank', { status: 'failed' } as const],
  ])('%s: keine Einladung', async (_case, result) => {
    vi.mocked(insertLicense).mockResolvedValue(result)
    await assignLicense({ email: 'teilnehmer@example.com' })
    expect(deliverInvitation).not.toHaveBeenCalled()
  })

  it('nicht zugeordnet, Feldfehler oder abgemeldet: keine Einladung', async () => {
    vi.mocked(requireTrainingProvider).mockResolvedValueOnce({ status: 'unassigned', userId: 'user-1' })
    await assignLicense({ email: 'teilnehmer@example.com' })

    await assignLicense({ email: 'keine-adresse' })

    vi.mocked(requireTrainingProvider).mockRejectedValueOnce(new Error('NEXT_REDIRECT /login?reason=session'))
    await expect(assignLicense({ email: 'teilnehmer@example.com' })).rejects.toThrow('NEXT_REDIRECT')

    expect(deliverInvitation).not.toHaveBeenCalled()
  })

  it('Entziehen versendet keine Mail', async () => {
    await revokeLicense({ licenseId: LICENSE_ID })
    expect(deliverInvitation).not.toHaveBeenCalled()
  })
})

describe('revokeLicense', () => {
  it('löscht die Lizenz mit ID und Träger aus dem Wächter, frischt auf und meldet „entzogen“ (AC-8)', async () => {
    expect(await revokeLicense({ licenseId: LICENSE_ID })).toEqual({ status: 'revoked' })
    expect(deleteLicense).toHaveBeenCalledWith(PROVIDER_ID, LICENSE_ID)
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('ignoriert einen mitgeschickten Träger (AC-10)', async () => {
    await revokeLicense({ licenseId: LICENSE_ID, trainingProviderId: FOREIGN_PROVIDER_ID })
    expect(deleteLicense).toHaveBeenCalledWith(PROVIDER_ID, LICENSE_ID)
  })

  it('keine Zeile gelöscht: Seite auffrischen, Ergebnis „bereits entzogen“ (EC-3)', async () => {
    vi.mocked(deleteLicense).mockResolvedValue({ status: 'not_found' })
    expect(await revokeLicense({ licenseId: LICENSE_ID })).toEqual({ status: 'already_revoked' })
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('Fehler der Datenbank: Ergebnis „Fehler“, ohne Auffrischen (EC-5)', async () => {
    vi.mocked(deleteLicense).mockResolvedValue({ status: 'failed' })
    expect(await revokeLicense({ licenseId: LICENSE_ID })).toEqual({ status: 'failed' })
    expect(refresh).not.toHaveBeenCalled()
  })

  it.each([
    ['keine UUID', { licenseId: 'lizenz-1' }],
    ['ohne ID', {}],
    ['null', null],
  ])('eine manipulierte Anfrage (%s) endet mit „Fehler“, nichts wird gelöscht', async (_case, input) => {
    expect(await revokeLicense(input)).toEqual({ status: 'failed' })
    expect(deleteLicense).not.toHaveBeenCalled()
    expect(refresh).not.toHaveBeenCalled()
  })

  it('nicht zugeordnet: Ergebnis „nicht zugeordnet“, ohne etwas zu lesen oder zu schreiben (EC-7)', async () => {
    vi.mocked(requireTrainingProvider).mockResolvedValue({ status: 'unassigned', userId: 'user-1' })
    expect(await revokeLicense({ licenseId: LICENSE_ID })).toEqual({ status: 'unassigned' })
    expect(deleteLicense).not.toHaveBeenCalled()
    expect(refresh).not.toHaveBeenCalled()
  })

  it('abgemeldet: die Weiterleitung des Wächters geht durch, nichts wird gelöscht (EC-7)', async () => {
    vi.mocked(requireTrainingProvider).mockRejectedValue(new Error('NEXT_REDIRECT /login?reason=session'))
    await expect(revokeLicense({ licenseId: LICENSE_ID })).rejects.toThrow('NEXT_REDIRECT /login?reason=session')
    expect(deleteLicense).not.toHaveBeenCalled()
  })
})
