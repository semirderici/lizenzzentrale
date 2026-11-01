import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { toast } from 'sonner'
import { sendInvitation } from '../invitations.actions'
import type { SendInvitationResult } from '../invitations.rules'
import { SendInvitationButton } from './send-invitation-button'

// Only the Server Action and the toasts are replaced; rules, texts and the button are the real ones.
vi.mock('../invitations.actions', () => ({ sendInvitation: vi.fn() }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const LICENSE_ID = '6f1c2a4e-8b3d-4c5e-9f7a-1b2c3d4e5f60'
const EMAIL = 'vorname.nachname+kurs@example.com'
const AVAILABLE_FROM = '2026-10-28T13:11:56.123Z'

const TEXT = {
  send: 'Einladung senden',
  resend: 'Erneut senden',
  sendName: `Einladung an ${EMAIL} senden`,
  resendName: `Einladung an ${EMAIL} erneut senden`,
  sent: 'Einladung versendet',
  sendFailed: 'Die Einladung konnte nicht versendet werden. Bitte versuchen Sie es später erneut.',
  alreadySending: 'Die Einladung wird gerade versendet.',
  licenseLimit:
    'Diese Einladung wurde in den letzten 24 Stunden bereits dreimal versendet. Sie können sie ab 28.10.2026, 14:12 Uhr erneut senden.',
  providerLimit:
    'Die Einladung wurde nicht versendet, weil Ihr Bildungsträger in den letzten 24 Stunden bereits 30 Einladungen versendet hat. Sie können sie ab 28.10.2026, 14:12 Uhr senden.',
  alreadyRevoked: 'Diese Lizenz wurde bereits entzogen.',
  unassigned: 'Ihr Konto ist keinem Bildungsträger zugeordnet. Bitte wenden Sie sich an den Anbieter.',
  failed: 'Das hat nicht geklappt. Bitte versuchen Sie es erneut.',
  noConnection: 'Keine Verbindung. Bitte versuchen Sie es erneut.',
}

function renderButton(action: 'send' | 'resend' = 'resend', appearance: 'compact' | 'full' = 'compact') {
  render(<SendInvitationButton licenseId={LICENSE_ID} email={EMAIL} action={action} appearance={appearance} />)
  return screen.getByRole('button', { name: action === 'send' ? TEXT.sendName : TEXT.resendName })
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('SendInvitationButton', () => {
  it('zeigt „Einladung senden“ bzw. „Erneut senden“, mit der Adresse im Namen für Screenreader (AC-4, AC-6)', () => {
    const { unmount } = render(
      <SendInvitationButton licenseId={LICENSE_ID} email={EMAIL} action="send" appearance="compact" />
    )
    expect(screen.getByRole('button', { name: TEXT.sendName })).toHaveTextContent(TEXT.send)
    unmount()

    expect(renderButton('resend')).toHaveTextContent(TEXT.resend)
  })

  it('ist ein Umriss-Knopf ohne Formular, den der Browser nie selbst absendet (AC-9)', () => {
    const button = renderButton()

    expect(button).toHaveAttribute('type', 'button')
    expect(button).toHaveClass('border-input')
    expect(button.closest('form')).toBeNull()
  })

  it('ist in der Tabelle klein gezeichnet mit 44 px Tippfläche und in der Karte 44 px hoch in voller Breite', () => {
    const { unmount } = render(
      <SendInvitationButton licenseId={LICENSE_ID} email={EMAIL} action="resend" appearance="compact" />
    )
    const compact = screen.getByRole('button', { name: TEXT.resendName })
    expect(compact).toHaveClass('h-9', 'relative', 'after:-inset-y-1')
    expect(compact).not.toHaveClass('w-full')
    unmount()

    expect(renderButton('resend', 'full')).toHaveClass('h-11', 'w-full')
  })

  it('schickt beim Klick genau einmal nur die Lizenz-ID, nie die Adresse (AC-5, AC-9)', async () => {
    vi.mocked(sendInvitation).mockResolvedValue({ status: 'sent' })
    fireEvent.click(renderButton())

    await waitFor(() => expect(toast.success).toHaveBeenCalled())
    expect(sendInvitation).toHaveBeenCalledTimes(1)
    expect(vi.mocked(sendInvitation).mock.calls[0]).toStrictEqual([{ licenseId: LICENSE_ID }])
  })

  it.each<[string, SendInvitationResult, string]>([
    ['fehlgeschlagen', { status: 'failed' }, TEXT.sendFailed],
    ['läuft schon', { status: 'already_sending' }, TEXT.alreadySending],
    ['Grenze der Lizenz', { status: 'license_limit', availableFrom: AVAILABLE_FROM }, TEXT.licenseLimit],
    ['Grenze des Trägers', { status: 'provider_limit', availableFrom: AVAILABLE_FROM }, TEXT.providerLimit],
    ['bereits entzogen', { status: 'already_revoked' }, TEXT.alreadyRevoked],
    ['Lizenz inzwischen weg', { status: 'not_found' }, TEXT.alreadyRevoked],
    ['nicht zugeordnet', { status: 'unassigned' }, TEXT.unassigned],
    ['Fehler', { status: 'error' }, TEXT.failed],
  ])('%s: Fehler-Toast mit dem Text aus dem Design (AC-5, AC-7, AC-8, EC-1, EC-5, EC-11)', async (_case, result, text) => {
    vi.mocked(sendInvitation).mockResolvedValue(result)
    fireEvent.click(renderButton())

    await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1))
    expect(toast.error).toHaveBeenCalledWith(text)
    expect(toast.success).not.toHaveBeenCalled()
  })

  it('versendet: Erfolgs-Toast „Einladung versendet“, danach ist der Knopf wieder frei (AC-5)', async () => {
    vi.mocked(sendInvitation).mockResolvedValue({ status: 'sent' })
    const button = renderButton()
    fireEvent.click(button)

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(TEXT.sent))
    expect(toast.error).not.toHaveBeenCalled()
    expect(button).toBeEnabled()
    expect(button).toHaveAttribute('aria-busy', 'false')
    expect(button.querySelector('svg')).toBeNull()
  })

  it('während des Sendens gesperrt, mit aria-busy und einem Symbol, das bei reduzierter Bewegung stillsteht', async () => {
    vi.mocked(sendInvitation).mockReturnValue(new Promise(() => {}))
    const button = renderButton()
    fireEvent.click(button)

    await waitFor(() => expect(button).toBeDisabled())
    expect(button).toHaveAttribute('aria-busy', 'true')
    const spinner = button.querySelector('svg')
    expect(spinner).toHaveAttribute('aria-hidden', 'true')
    expect(spinner).toHaveClass('animate-spin', 'motion-reduce:animate-none')
    expect(button).toHaveAccessibleName(TEXT.resendName)
  })

  it('ein Doppelklick ergibt nur einen Aufruf (EC-1)', async () => {
    vi.mocked(sendInvitation).mockReturnValue(new Promise(() => {}))
    const button = renderButton()

    fireEvent.click(button)
    fireEvent.click(button)

    await waitFor(() => expect(button).toBeDisabled())
    expect(sendInvitation).toHaveBeenCalledTimes(1)
  })

  it('keine Antwort vom App-Server: Fehler-Toast „Keine Verbindung“, Knopf wieder frei (EC-10)', async () => {
    vi.mocked(sendInvitation).mockRejectedValue(new TypeError('Failed to fetch'))
    const button = renderButton()
    fireEvent.click(button)

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(TEXT.noConnection))
    expect(button).toBeEnabled()
  })

  it('ein anderer Fehler beim Aufruf: Fehler-Toast „Das hat nicht geklappt“', async () => {
    vi.mocked(sendInvitation).mockRejectedValue(new Error('Server Action failed'))
    fireEvent.click(renderButton())

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(TEXT.failed))
  })

  it('anderswo abgemeldet: die Weiterleitung ist kein Fehler, kein Toast (EC-11)', async () => {
    vi.mocked(sendInvitation).mockRejectedValue(
      Object.assign(new Error('NEXT_REDIRECT'), { digest: 'NEXT_REDIRECT;replace;/login?reason=session;307;' })
    )
    fireEvent.click(renderButton())

    await waitFor(() => expect(sendInvitation).toHaveBeenCalled())
    await Promise.resolve()
    expect(toast.success).not.toHaveBeenCalled()
    expect(toast.error).not.toHaveBeenCalled()
  })
})
