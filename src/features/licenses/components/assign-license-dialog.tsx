'use client'
// Trigger and dialog "Lizenz zuweisen" (design.md → Dialoge, Regeln für die Dialoge, Darstellung
// der Ergebnisse). The browser checks with the shared schema; the server checks everything again.
// What the administrator can fix or retry stays in the dialog with the input; a result closes it
// with a toast. While sending, nothing closes the dialog before the answer is in (EC-2).
// "Lizenz zugewiesen" is a success or, when the invitation did not go out, a warning toast; both
// carry a second line about the invitation (PROJ-3 design.md → "Darstellung der Ergebnisse").
import { zodResolver } from '@hookform/resolvers/zod'
import { useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { FieldMessage, FormAlert, isRedirectError } from '@/components/form-feedback'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Form, FormControl, FormField, FormItem, FormLabel } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { assignLicense } from '../licenses.actions'
import {
  assignFeedback,
  LICENSE_MESSAGES,
  QUOTA_NOTICE_ID,
  thrownFeedback,
  type Feedback,
} from '../licenses.rules'
import {
  assignLicenseSchema,
  type AssignLicenseInput,
  type AssignLicenseValues,
} from '../licenses.schema'

const BUTTON_CLASS = 'h-11 w-full sm:w-auto'

export function AssignLicenseDialog({
  disabled,
  variant,
}: {
  disabled: boolean
  /** 'main' in the page header, 'empty' in the empty list (AC-3). */
  variant: 'main' | 'empty'
}) {
  const form = useForm<AssignLicenseInput, unknown, AssignLicenseValues>({
    resolver: zodResolver(assignLicenseSchema),
    defaultValues: { email: '' },
  })
  const [open, setOpen] = useState(false)
  const [alert, setAlert] = useState<string | null>(null)
  const emailInput = useRef<HTMLInputElement | null>(null)

  const sending = form.formState.isSubmitting

  function changeOpen(next: boolean) {
    if (!next && sending) return
    if (next) {
      // Every opening starts empty: no input, no field error, no box.
      form.reset({ email: '' })
      setAlert(null)
    }
    setOpen(next)
  }

  function show(feedback: Feedback) {
    switch (feedback.kind) {
      case 'success':
        toast.success(feedback.message, { description: feedback.description })
        return setOpen(false)
      case 'warning':
        toast.warning(feedback.message, { description: feedback.description })
        return setOpen(false)
      case 'error_toast':
        toast.error(feedback.message)
        return setOpen(false)
      case 'field':
        return form.setError('email', { message: feedback.message })
      case 'alert':
        return setAlert(feedback.message)
    }
  }

  async function submit(values: AssignLicenseValues) {
    setAlert(null)
    let feedback: Feedback
    try {
      feedback = assignFeedback(await assignLicense(values))
    } catch (error) {
      // Signed out elsewhere: the guard redirects to the login, which is happening (EC-7).
      if (isRedirectError(error)) return
      feedback = thrownFeedback(error)
    }
    show(feedback)
  }

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => form.handleSubmit(submit)(event)
  const keepOpenWhileSending = (event: Event) => {
    if (sending) event.preventDefault()
  }

  return (
    <>
      <Button
        type="button"
        variant={variant === 'main' ? 'default' : 'outline'}
        className={variant === 'main' ? 'h-11 w-full md:w-auto' : 'h-11'}
        disabled={disabled}
        // The notice says why nothing can be assigned (AC-7, AC-9).
        aria-describedby={disabled ? QUOTA_NOTICE_ID : undefined}
        onClick={() => changeOpen(true)}
      >
        {LICENSE_MESSAGES.assignAction}
      </Button>

      <Dialog open={open} onOpenChange={changeOpen}>
        <DialogContent
          onOpenAutoFocus={(event) => {
            event.preventDefault()
            emailInput.current?.focus()
          }}
          onEscapeKeyDown={keepOpenWhileSending}
          onInteractOutside={keepOpenWhileSending}
        >
          <DialogHeader>
            <DialogTitle>{LICENSE_MESSAGES.assignAction}</DialogTitle>
            <DialogDescription>{LICENSE_MESSAGES.assignDescription}</DialogDescription>
          </DialogHeader>

          <Form {...form}>
            {/* method="post" so that a submit before the script loads never puts the address in the URL. */}
            <form method="post" noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{LICENSE_MESSAGES.emailLabel}</FormLabel>
                    <FormControl>
                      {/* Off: it is not the administrator's own address. */}
                      <Input
                        type="email"
                        autoComplete="off"
                        className="h-11 text-base md:text-base"
                        {...field}
                        ref={(element) => {
                          field.ref(element)
                          emailInput.current = element
                        }}
                      />
                    </FormControl>
                    <FieldMessage />
                  </FormItem>
                )}
              />

              {alert ? <FormAlert message={alert} /> : null}

              <DialogFooter className="gap-2 sm:space-x-0">
                <Button
                  type="button"
                  variant="outline"
                  className={BUTTON_CLASS}
                  disabled={sending}
                  onClick={() => changeOpen(false)}
                >
                  {LICENSE_MESSAGES.cancel}
                </Button>
                <Button type="submit" className={BUTTON_CLASS} disabled={sending} aria-busy={sending}>
                  {LICENSE_MESSAGES.assignSubmit}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  )
}
