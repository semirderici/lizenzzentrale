import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useImperativeHandle } from 'react'
import { register } from '../account.actions'
import type { BotCheckProps } from './bot-check'
import { RegisterForm } from './register-form'

// Only the Server Action and the Turnstile widget are replaced; schema, messages and the shared
// form parts are the real ones.
const bot = vi.hoisted(() => ({ props: null as BotCheckProps | null, reset: vi.fn() }))

vi.mock('../account.actions', () => ({ register: vi.fn() }))
vi.mock('./bot-check', () => ({
  BotCheck: function FakeBotCheck(props: BotCheckProps) {
    bot.props = props
    useImperativeHandle(props.ref, () => ({
      reset() {
        bot.reset()
        props.onToken(null)
      },
    }))
    return <div data-testid="bot-check" />
  },
}))

const TEXT = {
  duplicate: 'Mit dieser E-Mail-Adresse ist bereits ein Konto registriert. Bitte melden Sie sich an.',
  registrationFailed: 'Die Registrierung ist fehlgeschlagen. Bitte versuchen Sie es erneut.',
  tooManyRegistrations: 'Zu viele Registrierungen. Bitte versuchen Sie es später erneut.',
  noConnection: 'Keine Verbindung. Bitte versuchen Sie es erneut.',
  botCheckUnavailable: 'Die Sicherheitsprüfung konnte nicht geladen werden. Bitte laden Sie die Seite neu.',
}

const input = (label: string) => screen.getByLabelText(label) as HTMLInputElement
const nameInput = () => input('Name des Bildungsträgers')
const emailInput = () => input('E-Mail-Adresse')
const passwordInput = () => input('Passwort')
const confirmationInput = () => input('Passwort wiederholen')
const submitButton = () => screen.getByRole('button', { name: 'Registrieren' })

function giveToken(token: string | null = 'token-1') {
  act(() => bot.props!.onToken(token))
}

function fillIn(values: { name?: string; email?: string; password?: string; confirmation?: string }) {
  const { name = '  Akademie Nord ', email = ' Verwalter@Akademie.DE', password = ' Geheim 123 ' } = values
  fireEvent.change(nameInput(), { target: { value: name } })
  fireEvent.change(emailInput(), { target: { value: email } })
  fireEvent.change(passwordInput(), { target: { value: password } })
  fireEvent.change(confirmationInput(), { target: { value: values.confirmation ?? password } })
}

async function submitValid() {
  fillIn({})
  giveToken()
  fireEvent.click(submitButton())
  await waitFor(() => expect(register).toHaveBeenCalled())
}

function expectStartedOver() {
  expect(passwordInput().value).toBe('')
  expect(confirmationInput().value).toBe('')
  expect(nameInput().value).toBe('  Akademie Nord ')
  expect(emailInput().value).toBe('Verwalter@Akademie.DE')
  expect(bot.reset).toHaveBeenCalledTimes(1)
  expect(submitButton()).toBeDisabled()
}

afterEach(() => {
  vi.clearAllMocks()
  bot.props = null
})

describe('RegisterForm', () => {
  it('zeigt die vier Felder mit den richtigen Feldarten und die Bot-Prüfung und sendet per POST (AC-1, AC-7)', () => {
    const { container } = render(<RegisterForm />)

    expect(nameInput()).toHaveAttribute('autocomplete', 'organization')
    expect(emailInput()).toHaveAttribute('type', 'email')
    expect(emailInput()).toHaveAttribute('autocomplete', 'email')
    for (const field of [passwordInput(), confirmationInput()]) {
      expect(field).toHaveAttribute('type', 'password')
      expect(field).toHaveAttribute('autocomplete', 'new-password')
    }
    expect(screen.getByTestId('bot-check')).toBeInTheDocument()
    expect(container.querySelector('form')).toHaveAttribute('method', 'post')
  })

  it('nennt die Passwortregel schon vor der Eingabe unter dem Passwortfeld (AC-2)', () => {
    render(<RegisterForm />)

    const hint = screen.getByText('Mindestens 8 Zeichen.')
    expect(passwordInput().getAttribute('aria-describedby')).toContain(hint.id)
  })

  it('sperrt den Knopf ohne Token und gibt ihn mit Token frei (AC-7, EC-8)', () => {
    render(<RegisterForm />)
    expect(submitButton()).toBeDisabled()

    giveToken()
    expect(submitButton()).toBeEnabled()
  })

  it('meldet ungültige Felder schon im Browser, ruft den Server nicht und lässt Name und E-Mail stehen (AC-2)', async () => {
    render(<RegisterForm />)
    fillIn({ name: ' A ', email: 'keine-adresse', password: 'kurz', confirmation: 'anders' })
    giveToken()

    fireEvent.click(submitButton())

    expect(await screen.findByText('Der Name muss mindestens 2 Zeichen lang sein.')).toBeInTheDocument()
    expect(screen.getByText('Bitte geben Sie eine gültige E-Mail-Adresse ein.')).toBeInTheDocument()
    expect(screen.getByText('Das Passwort muss mindestens 8 Zeichen lang sein.')).toBeInTheDocument()
    expect(screen.getByText('Die Passwörter stimmen nicht überein.')).toBeInTheDocument()
    expect(nameInput().value).toBe(' A ')
    expect(emailInput().value).toBe('keine-adresse')
    expect(register).not.toHaveBeenCalled()
  })

  it('schickt den gekürzten Namen, die normalisierte Adresse, das Passwort unverändert und das Token (AC-1, EC-4)', async () => {
    vi.mocked(register).mockResolvedValue({ formError: { message: TEXT.registrationFailed } })
    render(<RegisterForm />)

    await submitValid()

    expect(register).toHaveBeenCalledWith({
      trainingProviderName: 'Akademie Nord',
      email: 'verwalter@akademie.de',
      password: ' Geheim 123 ',
      passwordConfirmation: ' Geheim 123 ',
      turnstileToken: 'token-1',
    })
  })

  it('sperrt den Knopf während des Sendens mit aria-busy, ein zweiter Klick sendet nicht (EC-1)', async () => {
    vi.mocked(register).mockReturnValue(new Promise(() => {}))
    render(<RegisterForm />)

    await submitValid()
    fireEvent.click(submitButton())

    expect(submitButton()).toBeDisabled()
    expect(submitButton()).toHaveAttribute('aria-busy', 'true')
    expect(register).toHaveBeenCalledTimes(1)
  })

  it('zeigt bei einer schon registrierten Adresse die Meldung mit dem Link „Zum Login“ (AC-3)', async () => {
    vi.mocked(register).mockResolvedValue({ formError: { message: TEXT.duplicate, loginLink: true } })
    render(<RegisterForm />)

    await submitValid()

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(TEXT.duplicate)
    expect(screen.getByRole('link', { name: 'Zum Login' })).toHaveAttribute('href', '/login')
    expectStartedOver()
  })

  it('zeigt einen Formularfehler ohne Link, leert beide Passwörter und behält Name und E-Mail (EC-3)', async () => {
    vi.mocked(register).mockResolvedValue({ formError: { message: TEXT.tooManyRegistrations } })
    render(<RegisterForm />)

    await submitValid()

    expect(await screen.findByRole('alert')).toHaveTextContent(TEXT.tooManyRegistrations)
    expect(screen.queryByRole('link', { name: 'Zum Login' })).toBeNull()
    expectStartedOver()
  })

  it('zeigt Feldfehler vom Server am Feld (AC-2)', async () => {
    vi.mocked(register).mockResolvedValue({ fieldErrors: { password: 'Das Passwort muss mindestens 8 Zeichen lang sein.' } })
    render(<RegisterForm />)

    await submitValid()

    expect(await screen.findByText('Das Passwort muss mindestens 8 Zeichen lang sein.')).toBeInTheDocument()
    expect(passwordInput()).toHaveAttribute('aria-invalid', 'true')
  })

  it('zeigt nach der Weiterleitung zum Erfolg keinen Fehler und bleibt gesperrt (AC-1)', async () => {
    vi.mocked(register).mockRejectedValue(Object.assign(new Error('NEXT_REDIRECT'), { digest: 'NEXT_REDIRECT;push;/licenses;303;' }))
    render(<RegisterForm />)

    await submitValid()

    await waitFor(() => expect(submitButton()).toHaveAttribute('aria-busy', 'true'))
    expect(screen.queryByRole('alert')).toBeNull()
    expect(bot.reset).not.toHaveBeenCalled()
  })

  it('zeigt ohne Antwort „Keine Verbindung“ und behält Name und E-Mail (EC-9)', async () => {
    vi.mocked(register).mockRejectedValue(new TypeError('Failed to fetch'))
    render(<RegisterForm />)

    await submitValid()

    expect(await screen.findByRole('alert')).toHaveTextContent(TEXT.noConnection)
    expectStartedOver()
  })

  it('zeigt bei einem Fehler des Servers die Meldung aus EC-3, nicht „Keine Verbindung“ (EC-3)', async () => {
    vi.mocked(register).mockRejectedValue(new Error('An unexpected response was received from the server.'))
    render(<RegisterForm />)

    await submitValid()

    expect(await screen.findByRole('alert')).toHaveTextContent(TEXT.registrationFailed)
  })

  it('zeigt die Meldung aus EC-8 und bleibt gesperrt, auch wenn später ein Token kommt (EC-8)', () => {
    render(<RegisterForm />)

    act(() => bot.props!.onUnavailable())
    giveToken()

    expect(screen.getByRole('alert')).toHaveTextContent(TEXT.botCheckUnavailable)
    expect(submitButton()).toBeDisabled()
  })
})
