'use client'
// "Einladung senden" / "Erneut senden" (design.md → Knopf „Erneut senden“ / „Einladung senden“,
// Darstellung der Ergebnisse). A plain button without dialog or form: the click calls the Server
// Action with the licence id only, which goes out as a POST; there is nothing the browser could
// submit natively. Every answer comes as a toast; the list refreshes itself from the action.
import { Loader2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { isRedirectError } from '@/components/form-feedback'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { sendInvitation } from '../invitations.actions'
import {
  sendButtonAccessibleLabel,
  sendButtonLabel,
  sendFeedback,
  sendThrownFeedback,
  type SendFeedback,
} from '../invitations.rules'

// compact: drawn 36 px in the desktop table, the tap area still 44 × 44 px; full: the phone card.
const BUTTON_CLASS = {
  compact: 'relative h-9 after:absolute after:inset-x-0 after:-inset-y-1',
  full: 'h-11 w-full',
} as const

export function SendInvitationButton({
  licenseId,
  email,
  action,
  appearance,
}: {
  licenseId: string
  /** Only for the screen-reader name; it never leaves the browser. */
  email: string
  action: 'send' | 'resend'
  appearance: 'compact' | 'full'
}) {
  const [sending, setSending] = useState(false)
  // A second click before the re-render must not start a second call (EC-1).
  const inFlight = useRef(false)

  async function send() {
    if (inFlight.current) return
    inFlight.current = true
    setSending(true)
    let feedback: SendFeedback
    try {
      feedback = sendFeedback(await sendInvitation({ licenseId }))
    } catch (error) {
      // Signed out in another tab: the redirect to the login is under way (EC-11).
      if (isRedirectError(error)) return
      feedback = sendThrownFeedback(error)
    }
    inFlight.current = false
    setSending(false)

    if (feedback.kind === 'success') toast.success(feedback.message)
    else toast.error(feedback.message)
  }

  return (
    <Button
      type="button"
      variant="outline"
      aria-label={sendButtonAccessibleLabel(action, email)}
      aria-busy={sending}
      disabled={sending}
      onClick={send}
      className={cn('shrink-0', BUTTON_CLASS[appearance])}
    >
      {sending ? <Loader2 aria-hidden="true" className="animate-spin motion-reduce:animate-none" /> : null}
      {sendButtonLabel(action)}
    </Button>
  )
}
