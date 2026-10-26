import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { toast } from 'sonner'
import { assignLicense } from '../licenses.actions'
import { AssignLicenseDialog } from './assign-license-dialog'

// Only the Server Action and the toasts are replaced; schema, messages and the shared form parts
// are the real ones.
vi.mock('../licenses.actions', () => ({ assignLicense: vi.fn() }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const TEXT = {
  action: 'Lizenz zuweisen',
  description: 'Geben Sie die E-Mail-Adresse des Teilnehmers ein.',
  field: 'E-Mail-Adresse des Teilnehmers',
  required: 'Bitte geben Sie die E-Mail-Adresse des Teilnehmers ein.',
  invalid: 'Bitte geben Sie eine gültige E-Mail-Adresse ein.',
  assigned: 'Lizenz zugewiesen',
  alreadyAssigned: 'Diese E-Mail-Adresse hat bereits eine Lizenz.',
  exhausted: 'Ihr Kontingent ist ausgeschöpft.',
  unassigned: 'Ihr Konto ist keinem Bildungsträger zugeordnet. Bitte wenden Sie sich an den Anbieter.',
  failed: 'Das hat nicht geklappt. Bitte versuchen Sie es erneut.',
  noConnection: 'Keine Verbindung. Bitte versuchen Sie es erneut.',
}

const trigger = () => screen.getByRole('button', { name: TEXT.action })
const dialog = () => screen.queryByRole('dialog')
const emailInput = () => screen.getByLabelText(TEXT.field) as HTMLInputElement
const submitButton = () => screen.getByRole('button', { name: 'Zuweisen' })
const cancelButton = () => screen.getByRole('button', { name: 'Abbrechen' })

function openDialog(props: Partial<React.ComponentProps<typeof AssignLicenseDialog>> = {}) {
  render(<AssignLicenseDialog disabled={false} variant="main" {...props} />)
  fireEvent.click(trigger())
}

function submitWith(email: string) {
  fireEvent.change(emailInput(), { target: { value: email } })
  fireEvent.click(submitButton())
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('AssignLicenseDialog', () => {
  it('zeigt den Auslöseknopf als Hauptaktion in voller Breite auf dem Smartphone (AC-4)', () => {
    render(<AssignLicenseDialog disabled={false} variant="main" />)
    expect(trigger()).toBeEnabled()
    expect(trigger()).toHaveClass('h-11', 'w-full', 'md:w-auto')
    expect(trigger()).not.toHaveAttribute('aria-describedby')
  })

  it('zeigt den Auslöseknopf im leeren Zustand als Outline-Knopf (AC-3)', () => {
    render(<AssignLicenseDialog disabled={false} variant="empty" />)
    expect(trigger()).toHaveClass('h-11', 'border')
    expect(trigger()).not.toHaveClass('w-full')
  })

  it('ist gesperrt, solange keine Lizenz frei ist, und verweist auf den Hinweis (AC-7, AC-9)', () => {
    render(<AssignLicenseDialog disabled variant="main" />)
    expect(trigger()).toBeDisabled()
    expect(trigger()).toHaveAttribute('aria-describedby', 'license-quota-notice')
    fireEvent.click(trigger())
    expect(dialog()).toBeNull()
  })

  it('öffnet mit Titel, Text und leerem Feld, das den Fokus hat, und sendet per POST (AC-4)', async () => {
    openDialog()
    expect(screen.getByRole('heading', { name: TEXT.action })).toBeInTheDocument()
    expect(screen.getByText(TEXT.description)).toBeInTheDocument()
    expect(emailInput()).toHaveValue('')
    expect(emailInput()).toHaveAttribute('type', 'email')
    expect(emailInput()).toHaveAttribute('autocomplete', 'off')
    expect(emailInput().closest('form')).toHaveAttribute('method', 'post')
    await waitFor(() => expect(emailInput()).toHaveFocus())
  })

  it.each([
    ['leer', '   ', TEXT.required],
    ['ungültig', 'teilnehmer@', TEXT.invalid],
  ])('prüft im Browser: %s → Meldung am Feld, die Eingabe bleibt, die Action wird nicht aufgerufen (AC-5)', async (_case, email, message) => {
    openDialog()
    submitWith(email)
    expect(await screen.findByText(message)).toBeInTheDocument()
    expect(emailInput()).toHaveAttribute('aria-invalid', 'true')
    // An input of type email drops blanks at the edges itself (HTML value sanitization).
    expect(emailInput()).toHaveValue(email.trim())
    expect(assignLicense).not.toHaveBeenCalled()
    expect(dialog()).toBeInTheDocument()
  })

  it('schickt die normalisierte Adresse, meldet „Lizenz zugewiesen“ und schließt (AC-4)', async () => {
    vi.mocked(assignLicense).mockResolvedValue({ status: 'assigned' })
    openDialog()
    submitWith(' Teilnehmer@Example.COM ')
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(TEXT.assigned))
    expect(assignLicense).toHaveBeenCalledWith({ email: 'teilnehmer@example.com' })
    await waitFor(() => expect(dialog()).toBeNull())
  })

  it('schon vergeben: Meldung am Feld, Dialog und Eingabe bleiben (AC-6)', async () => {
    vi.mocked(assignLicense).mockResolvedValue({ status: 'field_error', message: TEXT.alreadyAssigned })
    openDialog()
    submitWith('teilnehmer@example.com')
    expect(await screen.findByText(TEXT.alreadyAssigned)).toBeInTheDocument()
    expect(dialog()).toBeInTheDocument()
    expect(emailInput()).toHaveValue('teilnehmer@example.com')
    expect(toast.success).not.toHaveBeenCalled()
    expect(toast.error).not.toHaveBeenCalled()
  })

  it('ausgeschöpft: Fehler-Toast „Ihr Kontingent ist ausgeschöpft.“ und der Dialog schließt (EC-1)', async () => {
    vi.mocked(assignLicense).mockResolvedValue({ status: 'exhausted' })
    openDialog()
    submitWith('teilnehmer@example.com')
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(TEXT.exhausted))
    expect(toast.success).not.toHaveBeenCalled()
    await waitFor(() => expect(dialog()).toBeNull())
  })

  it('nicht zugeordnet: Fehler-Toast mit der Meldung aus PROJ-1 EC-5 und der Dialog schließt (EC-7)', async () => {
    vi.mocked(assignLicense).mockResolvedValue({ status: 'unassigned' })
    openDialog()
    submitWith('teilnehmer@example.com')
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(TEXT.unassigned))
    await waitFor(() => expect(dialog()).toBeNull())
  })

  it.each([
    ['Fehler vom Server', () => vi.mocked(assignLicense).mockResolvedValue({ status: 'failed' }), TEXT.failed],
    ['keine Verbindung', () => vi.mocked(assignLicense).mockRejectedValue(new TypeError('Failed to fetch')), TEXT.noConnection],
    [
      'unerwartete Antwort',
      () => vi.mocked(assignLicense).mockRejectedValue(new Error('An unexpected response was received from the server.')),
      TEXT.failed,
    ],
  ])('%s: Hinweisbox im Dialog, die Eingabe bleibt (EC-5)', async (_case, arrange, message) => {
    arrange()
    openDialog()
    submitWith('teilnehmer@example.com')
    expect(await screen.findByRole('alert')).toHaveTextContent(message)
    expect(dialog()).toBeInTheDocument()
    expect(emailInput()).toHaveValue('teilnehmer@example.com')
    expect(toast.error).not.toHaveBeenCalled()
  })

  it('abgemeldet: die Weiterleitung zum Login ist kein Fehler, weder Toast noch Hinweisbox (EC-7)', async () => {
    vi.mocked(assignLicense).mockRejectedValue(
      Object.assign(new Error('NEXT_REDIRECT'), { digest: 'NEXT_REDIRECT;push;/login?reason=session;303;' })
    )
    openDialog()
    submitWith('teilnehmer@example.com')
    await waitFor(() => expect(assignLicense).toHaveBeenCalled())
    await waitFor(() => expect(submitButton()).toBeEnabled())
    expect(screen.queryByRole('alert')).toBeNull()
    expect(toast.success).not.toHaveBeenCalled()
    expect(toast.error).not.toHaveBeenCalled()
  })

  it('während des Sendens: beide Knöpfe gesperrt, Escape schließt nicht, ein zweiter Klick sendet nicht noch einmal (EC-2)', async () => {
    vi.mocked(assignLicense).mockReturnValue(new Promise(() => {}))
    openDialog()
    submitWith('teilnehmer@example.com')
    await waitFor(() => expect(submitButton()).toBeDisabled())
    expect(submitButton()).toHaveAttribute('aria-busy', 'true')
    expect(cancelButton()).toBeDisabled()

    fireEvent.click(submitButton())
    fireEvent.keyDown(dialog()!, { key: 'Escape' })
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))

    expect(dialog()).toBeInTheDocument()
    expect(assignLicense).toHaveBeenCalledTimes(1)
  })

  it('Abbrechen schließt den Dialog ohne Aufruf, beim nächsten Öffnen ist das Feld leer und ohne Fehler', async () => {
    vi.mocked(assignLicense).mockResolvedValue({ status: 'field_error', message: TEXT.alreadyAssigned })
    openDialog()
    submitWith('teilnehmer@example.com')
    expect(await screen.findByText(TEXT.alreadyAssigned)).toBeInTheDocument()

    fireEvent.click(cancelButton())
    await waitFor(() => expect(dialog()).toBeNull())
    fireEvent.click(trigger())

    expect(emailInput()).toHaveValue('')
    expect(screen.queryByText(TEXT.alreadyAssigned)).toBeNull()
    expect(emailInput()).not.toHaveAttribute('aria-invalid', 'true')
    expect(assignLicense).toHaveBeenCalledTimes(1)
  })
})
