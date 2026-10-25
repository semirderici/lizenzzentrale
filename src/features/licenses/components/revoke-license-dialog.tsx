'use client'
// "Entziehen" and its confirmation dialog (design.md → Dialoge, Regeln für die Dialoge,
// Darstellung der Ergebnisse). Revoking cannot be undone, so the dialog asks first and closes
// only after the answer; what the administrator can retry stays in the dialog, a result comes as
// a toast. The address is always plain text (EC-8).
import { useState } from 'react'
import { toast } from 'sonner'
import { FormAlert, isRedirectError } from '@/components/form-feedback'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { revokeLicense } from '../licenses.actions'
import {
  LICENSE_MESSAGES,
  revokeFeedback,
  revokeLabel,
  revokeTitle,
  thrownFeedback,
  type Feedback,
} from '../licenses.rules'

// compact: drawn 36 px in the desktop table, the tap area still 44 × 44 px; full: the phone card.
const TRIGGER_CLASS = {
  compact: 'relative h-9 after:absolute after:inset-x-0 after:-inset-y-1',
  full: 'h-11 w-full',
} as const

export function RevokeLicenseDialog({
  licenseId,
  email,
  appearance,
}: {
  licenseId: string
  email: string
  appearance: 'compact' | 'full'
}) {
  const [open, setOpen] = useState(false)
  const [sending, setSending] = useState(false)
  const [alert, setAlert] = useState<string | null>(null)

  function changeOpen(next: boolean) {
    // While sending, the dialog closes only with the answer (EC-2, EC-5).
    if (sending) return
    if (next) setAlert(null)
    setOpen(next)
  }

  async function confirm() {
    setAlert(null)
    setSending(true)
    let feedback: Feedback
    try {
      feedback = revokeFeedback(await revokeLicense({ licenseId }))
    } catch (error) {
      // Signed out in another tab: the redirect to the login is under way (EC-7).
      if (isRedirectError(error)) return
      feedback = thrownFeedback(error)
    }
    setSending(false)

    if (feedback.kind === 'alert') return setAlert(feedback.message)
    if (feedback.kind === 'success') toast.success(feedback.message)
    else toast.error(feedback.message)
    setOpen(false)
  }

  return (
    <AlertDialog open={open} onOpenChange={changeOpen}>
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          variant="destructive"
          aria-label={revokeLabel(email)}
          className={cn('shrink-0', TRIGGER_CLASS[appearance])}
        >
          {LICENSE_MESSAGES.revoke}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent onEscapeKeyDown={(event) => sending && event.preventDefault()}>
        <AlertDialogHeader>
          <AlertDialogTitle className="[overflow-wrap:anywhere]">{revokeTitle(email)}</AlertDialogTitle>
          <AlertDialogDescription className="type-body">
            {LICENSE_MESSAGES.revokeDescription}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {alert ? <FormAlert message={alert} /> : null}

        <AlertDialogFooter className="gap-2 sm:gap-0">
          {/* Radix gives "Abbrechen" the focus when the dialog opens. */}
          <AlertDialogCancel className="mt-0 h-11 w-full sm:w-auto" disabled={sending}>
            {LICENSE_MESSAGES.cancel}
          </AlertDialogCancel>
          {/* A plain button, not AlertDialogAction: the dialog must stay open until the answer. */}
          <Button
            type="button"
            variant="destructive"
            className="h-11 w-full sm:w-auto"
            disabled={sending}
            aria-busy={sending}
            onClick={confirm}
          >
            {LICENSE_MESSAGES.revoke}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
