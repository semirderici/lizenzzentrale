// @vitest-environment node
// The guard, the visibility check, the delivery and refresh() are replaced, so each test sees
// exactly which steps a request reaches (design.md → "Senden und erneut senden — sendInvitation").
// Schema and rules are the real ones.
import { refresh } from 'next/cache'
import { requireTrainingProvider } from '@/features/account/session.data'
import { sendInvitation } from './invitations.actions'
import { isLicenseVisible } from './invitations.data'
import { deliverInvitation } from './invitations.delivery'
import type { DeliveryOutcome } from './invitations.rules'

vi.mock('next/cache', () => ({ refresh: vi.fn() }))
vi.mock('@/features/account/session.data', () => ({ requireTrainingProvider: vi.fn() }))
vi.mock('./invitations.data', () => ({ isLicenseVisible: vi.fn() }))
vi.mock('./invitations.delivery', () => ({ deliverInvitation: vi.fn() }))

const PROVIDER_ID = '0b6f2f7e-8a41-4d5c-9c1e-2a7d3b4c5e6f'
const PROVIDER_NAME = 'Akademie Nord'
const FOREIGN_PROVIDER_ID = '7c1d9e2a-3b4f-4a6c-8d7e-9f0a1b2c3d4e'
const LICENSE_ID = '3f2b8c1e-5d4a-4c7b-9e2f-1a2b3c4d5e6f'
const FOREIGN_LICENSE_ID = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d'
const AVAILABLE_FROM = '2026-10-28T09:14:30.000Z'

function assignedWithQuota(licenseQuota: number) {
  return {
    status: 'assigned' as const,
    userId: 'user-1',
    role: 'admin' as const,
    trainingProvider: { id: PROVIDER_ID, name: PROVIDER_NAME, licenseQuota },
  }
}

beforeEach(() => {
  vi.mocked(requireTrainingProvider).mockResolvedValue(assignedWithQuota(5))
  vi.mocked(isLicenseVisible).mockResolvedValue({ status: 'visible' })
  vi.mocked(deliverInvitation).mockResolvedValue({ status: 'sent' })
})

afterEach(() => {
  vi.clearAllMocks()
})

function expectNothingReadOrSent() {
  expect(isLicenseVisible).not.toHaveBeenCalled()
  expect(deliverInvitation).not.toHaveBeenCalled()
  expect(refresh).not.toHaveBeenCalled()
}

describe('sendInvitation', () => {
  it('prüft die Lizenz beim Träger aus dem Wächter, versendet sie, frischt danach auf und meldet „versendet“ (AC-5)', async () => {
    expect(await sendInvitation({ licenseId: LICENSE_ID })).toStrictEqual({ status: 'sent' })

    expect(isLicenseVisible).toHaveBeenCalledTimes(1)
    expect(isLicenseVisible).toHaveBeenCalledWith(PROVIDER_ID, LICENSE_ID)
    expect(deliverInvitation).toHaveBeenCalledTimes(1)
    // Exactly id and name from the guard; nothing else reaches the delivery.
    expect(vi.mocked(deliverInvitation).mock.calls[0]).toStrictEqual([
      { id: PROVIDER_ID, name: PROVIDER_NAME },
      LICENSE_ID,
    ])
    expect(refresh).toHaveBeenCalledTimes(1)

    // Visibility first, then the delivery, then refresh, so the list shows the new state.
    const [visibleAt] = vi.mocked(isLicenseVisible).mock.invocationCallOrder
    const [deliveredAt] = vi.mocked(deliverInvitation).mock.invocationCallOrder
    const [refreshedAt] = vi.mocked(refresh).mock.invocationCallOrder
    expect(visibleAt).toBeLessThan(deliveredAt)
    expect(deliveredAt).toBeLessThan(refreshedAt)
  })

  it.each<[string, DeliveryOutcome]>([
    ['versendet (AC-5, AC-6)', { status: 'sent' }],
    ['fehlgeschlagen (AC-5)', { status: 'failed' }],
    ['Lizenz inzwischen weg (EC-5)', { status: 'not_found' }],
    ['läuft schon (EC-1)', { status: 'already_sending' }],
    ['Grenze der Lizenz (AC-7)', { status: 'license_limit', availableFrom: AVAILABLE_FROM }],
    ['Grenze des Trägers (AC-8)', { status: 'provider_limit', availableFrom: AVAILABLE_FROM }],
  ])('Versandausgang „%s“: unverändert als Ergebnis, Seite einmal aufgefrischt', async (_case, outcome) => {
    vi.mocked(deliverInvitation).mockResolvedValue(outcome)
    expect(await sendInvitation({ licenseId: LICENSE_ID })).toStrictEqual(outcome)
    expect(deliverInvitation).toHaveBeenCalledTimes(1)
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('abgemeldet: die Weiterleitung des Wächters geht durch, nichts wird gelesen oder versendet (EC-11)', async () => {
    vi.mocked(requireTrainingProvider).mockRejectedValue(new Error('NEXT_REDIRECT /login?reason=session'))
    await expect(sendInvitation({ licenseId: LICENSE_ID })).rejects.toThrow('NEXT_REDIRECT /login?reason=session')
    expectNothingReadOrSent()
  })

  it('nicht zugeordnet: Ergebnis „nicht zugeordnet“, ohne etwas zu lesen oder zu senden (EC-11)', async () => {
    vi.mocked(requireTrainingProvider).mockResolvedValue({ status: 'unassigned', userId: 'user-1' })
    expect(await sendInvitation({ licenseId: LICENSE_ID })).toStrictEqual({ status: 'unassigned' })
    expectNothingReadOrSent()
  })

  it.each([
    ['ohne ID', {}],
    ['keine UUID', { licenseId: 'lizenz-1' }],
    ['ID als Zahl', { licenseId: 42 }],
    ['kein Objekt', LICENSE_ID],
    ['null', null],
    ['nichts', undefined],
  ])('eine manipulierte Anfrage (%s) endet mit „Fehler“, nichts wird gelesen oder versendet', async (_case, input) => {
    expect(await sendInvitation(input)).toStrictEqual({ status: 'error' })
    expectNothingReadOrSent()
  })

  it('Fehler beim Prüfen der Lizenz: Ergebnis „Fehler“, nichts versendet, ohne Auffrischen', async () => {
    vi.mocked(isLicenseVisible).mockResolvedValue({ status: 'error' })
    expect(await sendInvitation({ licenseId: LICENSE_ID })).toStrictEqual({ status: 'error' })
    expect(deliverInvitation).not.toHaveBeenCalled()
    expect(refresh).not.toHaveBeenCalled()
  })

  it('Lizenz nicht mehr sichtbar: Seite auffrischen, Ergebnis „bereits entzogen“, nichts versendet (EC-5)', async () => {
    vi.mocked(isLicenseVisible).mockResolvedValue({ status: 'not_visible' })
    expect(await sendInvitation({ licenseId: LICENSE_ID })).toStrictEqual({ status: 'already_revoked' })
    expect(deliverInvitation).not.toHaveBeenCalled()
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('ignoriert mitgeschickte Adresse und Träger: Prüfung und Versand nur mit dem Träger aus dem Wächter (AC-9)', async () => {
    expect(
      await sendInvitation({
        licenseId: LICENSE_ID,
        email: 'angreifer@example.com',
        trainingProviderId: FOREIGN_PROVIDER_ID,
        training_provider_id: FOREIGN_PROVIDER_ID,
        trainingProvider: { id: FOREIGN_PROVIDER_ID, name: 'Fremde Akademie' },
      })
    ).toStrictEqual({ status: 'sent' })

    expect(isLicenseVisible).toHaveBeenCalledWith(PROVIDER_ID, LICENSE_ID)
    expect(vi.mocked(deliverInvitation).mock.calls).toStrictEqual([[{ id: PROVIDER_ID, name: PROVIDER_NAME }, LICENSE_ID]])
  })

  it('eine Lizenz von Träger B sieht aus wie entzogen und wird nie versendet (AC-9)', async () => {
    // Row Level Security and the provider filter hide B's licence from A's session.
    vi.mocked(isLicenseVisible).mockResolvedValue({ status: 'not_visible' })
    expect(
      await sendInvitation({ licenseId: FOREIGN_LICENSE_ID, trainingProviderId: FOREIGN_PROVIDER_ID })
    ).toStrictEqual({ status: 'already_revoked' })

    expect(isLicenseVisible).toHaveBeenCalledWith(PROVIDER_ID, FOREIGN_LICENSE_ID)
    expect(deliverInvitation).not.toHaveBeenCalled()
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['ausgeschöpft', 0],
    ['überschritten (unter die vergebenen Lizenzen gesenkt)', 1],
  ])('Kontingent %s: erneutes Senden geht wie sonst (EC-12)', async (_case, licenseQuota) => {
    vi.mocked(requireTrainingProvider).mockResolvedValue(assignedWithQuota(licenseQuota))
    expect(await sendInvitation({ licenseId: LICENSE_ID })).toStrictEqual({ status: 'sent' })
    expect(vi.mocked(deliverInvitation).mock.calls).toStrictEqual([[{ id: PROVIDER_ID, name: PROVIDER_NAME }, LICENSE_ID]])
    expect(refresh).toHaveBeenCalledTimes(1)
  })
})
