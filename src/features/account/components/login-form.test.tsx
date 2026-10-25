import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useImperativeHandle } from 'react'
import { login } from '../account.actions'
import type { BotCheckProps } from './bot-check'
import { LoginForm } from './login-form'

// Only the Server Action and the Turnstile widget are replaced; schema, messages and the shared
// form parts are the real ones.
const bot = vi.hoisted(() => ({ props: null as BotCheckProps | null, reset: vi.fn() }))

vi.mock('../account.actions', () => ({ login: vi.fn() }))
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
  invalidCredentials: 'E-Mail-Adresse oder Passwort ist falsch.',
  noConnection: 'Keine Verbindung. Bitte versuchen Sie es erneut.',
  loginFailed: 'Die Anmeldung ist fehlgeschlagen. Bitte versuchen Sie es erneut.',
  botCheckUnavailable: 'Die Sicherheitsprüfung konnte nicht geladen werden. Bitte laden Sie die Seite neu.',
  sessionEnded: 'Bitte melden Sie sich erneut an.',
}

const emailInput = () => screen.getByLabelText('E-Mail-Adresse') as HTMLInputElement
const passwordInput = () => screen.getByLabelText('Passwort') as HTMLInputElement
const submitButton = () => screen.getByRole('button', { name: 'Anmelden' })

function giveToken(token: string | null = 'token-1') {
  act(() => bot.props!.onToken(token))
}

function fillIn(email: string, password: string) {
  fireEvent.change(emailInput(), { target: { value: email } })
  fireEvent.change(passwordInput(), { target: { value: password } })
}

async function submitValid() {
  fillIn(' Verwalter@Akademie.DE ', ' Geheim 1 ')
  giveToken()
  fireEvent.click(submitButton())
  await waitFor(() => expect(login).toHaveBeenCalled())
}

afterEach(() => {
  vi.clearAllMocks()
  bot.props = null
})

describe('LoginForm', () => {
  it('zeigt E-Mail-Adresse, Passwort und Bot-Prüfung und sendet per POST (AC-4, AC-7)', () => {
    const { container } = render(<LoginForm />)

    expect(emailInput()).toHaveAttribute('type', 'email')
    expect(emailInput()).toHaveAttribute('autocomplete', 'email')
    expect(passwordInput()).toHaveAttribute('type', 'password')
    expect(passwordInput()).toHaveAttribute('autocomplete', 'current-password')
    expect(screen.getByTestId('bot-check')).toBeInTheDocument()
    expect(container.querySelector('form')).toHaveAttribute('method', 'post')
  })

  it('sperrt den Knopf ohne Token und gibt ihn mit Token frei (AC-7, EC-8)', () => {
    render(<LoginForm />)
    expect(submitButton()).toBeDisabled()

    giveToken()
    expect(submitButton()).toBeEnabled()

    giveToken(null)
    expect(submitButton()).toBeDisabled()
  })

  it('meldet leere Felder schon im Browser, mit Symbol am Feld, und ruft den Server nicht (AC-2)', async () => {
    render(<LoginForm />)
    giveToken()

    fireEvent.click(submitButton())

    expect(await screen.findByText('Bitte geben Sie Ihre E-Mail-Adresse ein.')).toBeInTheDocument()
    expect(screen.getByText('Bitte geben Sie Ihr Passwort ein.')).toBeInTheDocument()
    expect(emailInput()).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByText('Bitte geben Sie Ihr Passwort ein.').parentElement?.querySelector('svg')).not.toBeNull()
    expect(login).not.toHaveBeenCalled()
  })

  it('schickt die normalisierte Adresse, das Passwort unverändert und das Token (EC-4)', async () => {
    vi.mocked(login).mockResolvedValue({ formError: { message: TEXT.invalidCredentials } })
    render(<LoginForm />)

    await submitValid()

    expect(login).toHaveBeenCalledWith({
      email: 'verwalter@akademie.de',
      password: ' Geheim 1 ',
      turnstileToken: 'token-1',
    })
  })

  it('sperrt den Knopf während des Sendens mit aria-busy, ein zweiter Klick sendet nicht (EC-1)', async () => {
    vi.mocked(login).mockReturnValue(new Promise(() => {}))
    render(<LoginForm />)

    await submitValid()
    fireEvent.click(submitButton())

    expect(submitButton()).toBeDisabled()
    expect(submitButton()).toHaveAttribute('aria-busy', 'true')
    expect(login).toHaveBeenCalledTimes(1)
  })

  it('zeigt einen Formularfehler über dem Knopf, leert das Passwort, behält die E-Mail und setzt die Bot-Prüfung zurück (AC-5)', async () => {
    vi.mocked(login).mockResolvedValue({ formError: { message: TEXT.invalidCredentials } })
    render(<LoginForm />)

    await submitValid()

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(TEXT.invalidCredentials)
    expect(alert.compareDocumentPosition(submitButton()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(passwordInput().value).toBe('')
    // What the visitor typed stays; the browser drops the edge spaces of an email field itself.
    expect(emailInput().value).toBe('Verwalter@Akademie.DE')
    expect(bot.reset).toHaveBeenCalledTimes(1)
    expect(submitButton()).toBeDisabled()
  })

  it('zeigt die Sperrmeldung mit der Restzeit (AC-6)', async () => {
    const message = 'Zu viele Anmeldeversuche. Bitte versuchen Sie es in 15 Minuten erneut.'
    vi.mocked(login).mockResolvedValue({ formError: { message } })
    render(<LoginForm />)

    await submitValid()

    expect(await screen.findByRole('alert')).toHaveTextContent(message)
  })

  it('zeigt Feldfehler vom Server am Feld (AC-2)', async () => {
    vi.mocked(login).mockResolvedValue({ fieldErrors: { email: 'Bitte geben Sie eine gültige E-Mail-Adresse ein.' } })
    render(<LoginForm />)

    await submitValid()

    expect(await screen.findByText('Bitte geben Sie eine gültige E-Mail-Adresse ein.')).toBeInTheDocument()
    expect(emailInput()).toHaveAttribute('aria-invalid', 'true')
  })

  it('zeigt nach der Weiterleitung zum Erfolg keinen Fehler und bleibt gesperrt (AC-4)', async () => {
    vi.mocked(login).mockRejectedValue(Object.assign(new Error('NEXT_REDIRECT'), { digest: 'NEXT_REDIRECT;push;/licenses;303;' }))
    render(<LoginForm />)

    await submitValid()

    await waitFor(() => expect(submitButton()).toHaveAttribute('aria-busy', 'true'))
    expect(screen.queryByRole('alert')).toBeNull()
    expect(submitButton()).toBeDisabled()
    expect(passwordInput().value).toBe(' Geheim 1 ')
    expect(bot.reset).not.toHaveBeenCalled()
  })

  it('zeigt ohne Antwort „Keine Verbindung“, die E-Mail bleibt, das Passwort wird geleert (EC-9)', async () => {
    vi.mocked(login).mockRejectedValue(new TypeError('Failed to fetch'))
    render(<LoginForm />)

    await submitValid()

    expect(await screen.findByRole('alert')).toHaveTextContent(TEXT.noConnection)
    // What the visitor typed stays; the browser drops the edge spaces of an email field itself.
    expect(emailInput().value).toBe('Verwalter@Akademie.DE')
    expect(passwordInput().value).toBe('')
    expect(bot.reset).toHaveBeenCalledTimes(1)
  })

  it('zeigt bei einem Fehler des Servers die Anmeldemeldung, nicht „Keine Verbindung“', async () => {
    vi.mocked(login).mockRejectedValue(new Error('An unexpected response was received from the server.'))
    render(<LoginForm />)

    await submitValid()

    expect(await screen.findByRole('alert')).toHaveTextContent(TEXT.loginFailed)
  })

  it('zeigt die Meldung aus EC-8 und bleibt gesperrt, auch wenn später ein Token kommt (EC-8)', () => {
    render(<LoginForm />)

    act(() => bot.props!.onUnavailable())
    giveToken()

    expect(screen.getByRole('alert')).toHaveTextContent(TEXT.botCheckUnavailable)
    expect(submitButton()).toBeDisabled()
  })

  it('zeigt den Hinweis nach beendeter Sitzung nur, wenn die Seite ihn verlangt (EC-6)', () => {
    const { unmount } = render(<LoginForm sessionEnded />)
    expect(screen.getByRole('alert')).toHaveTextContent(TEXT.sessionEnded)
    unmount()

    render(<LoginForm />)
    expect(screen.queryByText(TEXT.sessionEnded)).toBeNull()
  })
})
