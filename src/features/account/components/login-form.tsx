'use client'
// Login form (design.md → Regeln für die Formulare, Anmelden). Field errors appear in the browser
// with the shared schema; the server checks everything again. The button stays locked without a
// bot-check token and while sending (EC-1, EC-8).
import { zodResolver } from '@hookform/resolvers/zod'
import { Info } from 'lucide-react'
import { useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Form, FormControl, FormField, FormItem, FormLabel } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { login } from '../account.actions'
import { MESSAGES, type FormError } from '../account.rules'
import { loginSchema, type LoginField, type LoginInput, type LoginValues } from '../account.schema'
import { BotCheck, type BotCheckHandle } from './bot-check'
import { FieldMessage, FormAlert, isConnectionError, isRedirectError } from './form-feedback'

const INPUT_CLASS = 'h-11 text-base md:text-base'

export function LoginForm({ sessionEnded = false }: { sessionEnded?: boolean }) {
  const form = useForm<LoginInput, unknown, LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '', turnstileToken: '' },
  })
  const botCheck = useRef<BotCheckHandle>(null)
  const [token, setToken] = useState<string | null>(null)
  const [botUnavailable, setBotUnavailable] = useState(false)
  const [formError, setFormError] = useState<FormError | null>(null)
  const [redirecting, setRedirecting] = useState(false)

  const sending = form.formState.isSubmitting || redirecting
  const shownError = botUnavailable ? { message: MESSAGES.botCheckUnavailable } : formError

  function handleToken(next: string | null) {
    setToken(next)
    form.setValue('turnstileToken', next ?? '')
  }

  /** After every answer from the server that is not a success: empty password, new token. */
  function startOver(error: FormError | null) {
    setFormError(error)
    form.setValue('password', '')
    botCheck.current?.reset()
  }

  async function submit(values: LoginValues) {
    setFormError(null)
    let state
    try {
      state = await login(values)
    } catch (error) {
      // The redirect after a success is never an error.
      if (isRedirectError(error)) return setRedirecting(true)
      return startOver({ message: isConnectionError(error) ? MESSAGES.noConnection : MESSAGES.loginFailed })
    }
    for (const [field, message] of Object.entries(state.fieldErrors ?? {})) {
      form.setError(field as LoginField, { message })
    }
    startOver(state.formError ?? null)
  }

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => form.handleSubmit(submit)(event)

  return (
    <Form {...form}>
      {/* method="post" so that a submit before the script loads never puts credentials in the URL. */}
      <form method="post" noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
        {sessionEnded ? (
          <Alert>
            <Info aria-hidden="true" className="size-4" />
            <AlertDescription className="type-small">{MESSAGES.sessionEnded}</AlertDescription>
          </Alert>
        ) : null}

        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>E-Mail-Adresse</FormLabel>
              <FormControl>
                <Input type="email" autoComplete="email" className={INPUT_CLASS} {...field} />
              </FormControl>
              <FieldMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Passwort</FormLabel>
              <FormControl>
                <Input type="password" autoComplete="current-password" className={INPUT_CLASS} {...field} />
              </FormControl>
              <FieldMessage />
            </FormItem>
          )}
        />

        <BotCheck ref={botCheck} onToken={handleToken} onUnavailable={() => setBotUnavailable(true)} />

        {shownError ? <FormAlert error={shownError} /> : null}

        <Button
          type="submit"
          className="h-11 w-full"
          disabled={!token || botUnavailable || sending}
          aria-busy={sending}
        >
          Anmelden
        </Button>
      </form>
    </Form>
  )
}
