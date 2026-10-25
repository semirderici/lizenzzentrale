import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { toast } from 'sonner'
import { revokeLicense } from '../licenses.actions'
import { RevokeLicenseDialog } from './revoke-license-dialog'

// Only the Server Action and the toasts are replaced; rules, texts and the dialog are the real ones.
vi.mock('../licenses.actions', () => ({ revokeLicense: vi.fn() }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const LICENSE_ID = '6f1c2a4e-8b3d-4c5e-9f7a-1b2c3d4e5f60'
const EMAIL = 'teilnehmer@example.com'

const TEXT = {
  title: 'Lizenz von teilnehmer@example.com entziehen?',
  description: 'Die Lizenz ist danach sofort wieder frei.',
  revoked: 'Lizenz entzogen',
  alreadyRevoked: 'Diese Lizenz wurde bereits entzogen.',
  unassigned: 'Ihr Konto ist keinem Bildungsträger zugeordnet. Bitte wenden Sie sich an den Anbieter.',
  failed: 'Das hat nicht geklappt. Bitte versuchen Sie es erneut.',
  noConnection: 'Keine Verbindung. Bitte versuchen Sie es erneut.',
}

const trigger = (email = EMAIL) => screen.getByRole('button', { name: `Lizenz von ${email} entziehen` })
const dialog = () => screen.getByRole('alertdialog')
const cancelButton = () => within(dialog()).getByRole('button', { name: 'Abbrechen' })
const confirmButton = () => within(dialog()).getByRole('button', { name: 'Entziehen' })

function openDialog(appearance: 'compact' | 'full' = 'compact', email = EMAIL) {
  render(<RevokeLicenseDialog licenseId={LICENSE_ID} email={email} appearance={appearance} />)
  fireEvent.click(trigger(email))
  return dialog()
}

async function expectClosed() {
  await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('RevokeLicenseDialog', () => {
  it('zeigt „Entziehen“ als destruktiven Knopf mit der Adresse im Namen für Screenreader (AC-2, AC-8)', () => {
    render(<RevokeLicenseDialog licenseId={LICENSE_ID} email={EMAIL} appearance="compact" />)

    expect(trigger()).toHaveTextContent('Entziehen')
    expect(trigger()).toHaveClass('shrink-0')
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('ist in der Tabelle klein gezeichnet und in der Karte 44 px hoch in voller Breite (EC-8)', () => {
    const { unmount } = render(<RevokeLicenseDialog licenseId={LICENSE_ID} email={EMAIL} appearance="compact" />)
    expect(trigger()).toHaveClass('h-9')
    expect(trigger()).not.toHaveClass('w-full')
    unmount()

    render(<RevokeLicenseDialog licenseId={LICENSE_ID} email={EMAIL} appearance="full" />)
    expect(trigger()).toHaveClass('h-11', 'w-full')
  })

  it('fragt nach, bevor etwas passiert, und „Abbrechen“ hat den Fokus (AC-8)', async () => {
    const opened = openDialog()

    expect(within(opened).getByRole('heading', { name: TEXT.title })).toBeInTheDocument()
    expect(within(opened).getByText(TEXT.description)).toBeInTheDocument()
    await waitFor(() => expect(cancelButton()).toHaveFocus())
    expect(revokeLicense).not.toHaveBeenCalled()
  })

  it('„Abbrechen“ schließt den Dialog, und nichts wird entzogen (AC-8)', async () => {
    openDialog()

    fireEvent.click(cancelButton())

    await expectClosed()
    expect(revokeLicense).not.toHaveBeenCalled()
    expect(toast.success).not.toHaveBeenCalled()
  })

  it('entzogen: genau ein Aufruf mit der Lizenz-ID, Toast „Lizenz entzogen“, Dialog zu (AC-8)', async () => {
    vi.mocked(revokeLicense).mockResolvedValue({ status: 'revoked' })
    openDialog()

    fireEvent.click(confirmButton())

    await expectClosed()
    expect(revokeLicense).toHaveBeenCalledTimes(1)
    expect(revokeLicense).toHaveBeenCalledWith({ licenseId: LICENSE_ID })
    expect(toast.success).toHaveBeenCalledWith(TEXT.revoked)
    expect(toast.error).not.toHaveBeenCalled()
  })

  it('bereits entzogen: Fehler-Toast, Dialog zu (EC-3)', async () => {
    vi.mocked(revokeLicense).mockResolvedValue({ status: 'already_revoked' })
    openDialog()

    fireEvent.click(confirmButton())

    await expectClosed()
    expect(toast.error).toHaveBeenCalledWith(TEXT.alreadyRevoked)
    expect(toast.success).not.toHaveBeenCalled()
  })

  it('nicht zugeordnet: Fehler-Toast mit der Meldung aus PROJ-1 EC-5, Dialog zu (EC-7)', async () => {
    vi.mocked(revokeLicense).mockResolvedValue({ status: 'unassigned' })
    openDialog()

    fireEvent.click(confirmButton())

    await expectClosed()
    expect(toast.error).toHaveBeenCalledWith(TEXT.unassigned)
  })

  it('Fehler auf dem Server: Hinweisbox im Dialog, „Entziehen“ lässt sich wieder klicken (EC-5)', async () => {
    vi.mocked(revokeLicense).mockResolvedValue({ status: 'failed' })
    openDialog()

    fireEvent.click(confirmButton())

    expect(await within(dialog()).findByText(TEXT.failed)).toBeInTheDocument()
    expect(confirmButton()).toBeEnabled()
    expect(confirmButton()).toHaveAttribute('aria-busy', 'false')
    expect(toast.success).not.toHaveBeenCalled()
    expect(toast.error).not.toHaveBeenCalled()
  })

  it('keine Antwort vom App-Server: „Keine Verbindung“ im Dialog (EC-5)', async () => {
    vi.mocked(revokeLicense).mockRejectedValue(new TypeError('Failed to fetch'))
    openDialog()

    fireEvent.click(confirmButton())

    expect(await within(dialog()).findByText(TEXT.noConnection)).toBeInTheDocument()
    expect(confirmButton()).toBeEnabled()
  })

  it('anderswo abgemeldet: die Weiterleitung ist kein Fehler, weder Toast noch Hinweisbox (EC-7)', async () => {
    vi.mocked(revokeLicense).mockRejectedValue(
      Object.assign(new Error('NEXT_REDIRECT'), { digest: 'NEXT_REDIRECT;replace;/login?reason=session;307;' })
    )
    openDialog()

    fireEvent.click(confirmButton())

    await waitFor(() => expect(revokeLicense).toHaveBeenCalled())
    await Promise.resolve()
    expect(within(dialog()).queryByText(TEXT.failed)).not.toBeInTheDocument()
    expect(within(dialog()).queryByText(TEXT.noConnection)).not.toBeInTheDocument()
    expect(toast.success).not.toHaveBeenCalled()
    expect(toast.error).not.toHaveBeenCalled()
  })

  it('während des Sendens sind beide Knöpfe gesperrt, und Escape schließt nicht (EC-5)', async () => {
    vi.mocked(revokeLicense).mockReturnValue(new Promise(() => {}))
    openDialog()

    fireEvent.click(confirmButton())

    await waitFor(() => expect(confirmButton()).toBeDisabled())
    expect(confirmButton()).toHaveAttribute('aria-busy', 'true')
    expect(cancelButton()).toBeDisabled()

    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' })
    expect(screen.getByRole('alertdialog')).toBeInTheDocument()
    expect(revokeLicense).toHaveBeenCalledTimes(1)
  })

  it('nach einer Hinweisbox ist sie beim nächsten Öffnen wieder weg (EC-5)', async () => {
    vi.mocked(revokeLicense).mockResolvedValue({ status: 'failed' })
    openDialog()
    fireEvent.click(confirmButton())
    await within(dialog()).findByText(TEXT.failed)

    fireEvent.click(cancelButton())
    await expectClosed()
    fireEvent.click(trigger())

    expect(within(dialog()).queryByText(TEXT.failed)).not.toBeInTheDocument()
  })

  it('zeigt eine Adresse mit HTML nur als Text (EC-8)', () => {
    const email = '<script>alert(1)</script>@example.com'
    const opened = openDialog('compact', email)

    expect(
      within(opened).getByRole('heading', { name: 'Lizenz von <script>alert(1)</script>@example.com entziehen?' })
    ).toBeInTheDocument()
    expect(document.querySelector('script')).toBeNull()
  })
})
