'use client'
// Register form (design.md → Regeln für die Formulare, Registrieren). Same rules as the login
// form: field errors in the browser with the shared schema, the button locked without a token
// and while sending, a server error clears both password fields and keeps name and address.
import { zodResolver } from '@hookform/resolvers/zod'
import Link from 'next/link'
import { useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { register } from '../account.actions'
import { MESSAGES, type FormError } from '../account.rules'
import { registerSchema, type RegisterField, type RegisterInput, type RegisterValues } from '../account.schema'
import { BotCheck, type BotCheckHandle } from './bot-check'
import { FieldMessage, FormAlert, isConnectionError, isRedirectError } from '@/components/form-feedback'

const INPUT_CLASS = 'h-11 text-base md:text-base'

export function RegisterForm() {
  const form = useForm<RegisterInput, unknown, RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      trainingProviderName: '',
      email: '',
      password: '',
      passwordConfirmation: '',
      turnstileToken: '',
    },
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

  /** After every answer from the server that is not a success: empty passwords, new token. */
  function startOver(error: FormError | null) {
    setFormError(error)
    form.setValue('password', '')
    form.setValue('passwordConfirmation', '')
    botCheck.current?.reset()
  }

  async function submit(values: RegisterValues) {
    setFormError(null)
    let state
    try {
      state = await register(values)
    } catch (error) {
      // The redirect after a success is never an error.
      if (isRedirectError(error)) return setRedirecting(true)
      return startOver({ message: isConnectionError(error) ? MESSAGES.noConnection : MESSAGES.registrationFailed })
    }
    for (const [field, message] of Object.entries(state.fieldErrors ?? {})) {
      form.setError(field as RegisterField, { message })
    }
    startOver(state.formError ?? null)
  }

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => form.handleSubmit(submit)(event)

  return (
    <Form {...form}>
      {/* method="post" so that a submit before the script loads never puts credentials in the URL. */}
      <form method="post" noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
        <FormField
          control={form.control}
          name="trainingProviderName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name des Bildungsträgers</FormLabel>
              <FormControl>
                <Input autoComplete="organization" className={INPUT_CLASS} {...field} />
              </FormControl>
              <FieldMessage />
            </FormItem>
          )}
        />
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
                <Input type="password" autoComplete="new-password" className={INPUT_CLASS} {...field} />
              </FormControl>
              {/* The rule is there before anyone types (AC-2). */}
              <FormDescription className="type-small">{MESSAGES.passwordHint}</FormDescription>
              <FieldMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="passwordConfirmation"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Passwort wiederholen</FormLabel>
              <FormControl>
                <Input type="password" autoComplete="new-password" className={INPUT_CLASS} {...field} />
              </FormControl>
              <FieldMessage />
            </FormItem>
          )}
        />

        <BotCheck ref={botCheck} onToken={handleToken} onUnavailable={() => setBotUnavailable(true)} />

        {shownError ? (
          <FormAlert message={shownError.message}>
            {shownError.loginLink ? (
              <>
                {' '}
                <Link href="/login" className="font-medium underline underline-offset-4">
                  {MESSAGES.toLogin}
                </Link>
              </>
            ) : null}
          </FormAlert>
        ) : null}

        <Button
          type="submit"
          className="h-11 w-full"
          disabled={!token || botUnavailable || sending}
          aria-busy={sending}
        >
          Registrieren
        </Button>
      </form>
    </Form>
  )
}
