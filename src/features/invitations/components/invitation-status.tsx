// Versandstand of one licence in the list (design.md → "Versandstand in der Liste",
// docs/design-system.md → Status-Badges): the word carries the state, colour and icon only
// support it, so the icon is hidden from screen readers. Purely presentational: the state comes
// in already computed (invitationDisplay), this component never reads the clock or the database.
import { CircleAlert, CircleCheck, Clock, Mail, type LucideIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { INVITATION_MESSAGES, type InvitationDisplay } from '../invitations.rules'

const NEUTRAL = 'bg-muted text-muted-foreground'

// Status colour on its subtle surface; the outline variant has no hover colour, a status is not
// clickable.
const LOOK: Record<InvitationDisplay['state'], { icon: LucideIcon; colors: string }> = {
  not_invited: { icon: Mail, colors: NEUTRAL },
  sending: { icon: Clock, colors: NEUTRAL },
  sent: { icon: CircleCheck, colors: 'bg-success-subtle text-success' },
  failed: { icon: CircleAlert, colors: 'bg-destructive-subtle text-destructive' },
}

export function InvitationStatus({ display }: { display: InvitationDisplay }) {
  const { icon: Icon, colors } = LOOK[display.state]

  return (
    // rounded-md: the design system gives badges the common radius, only avatars are round.
    // No nowrap: in a narrow card the text wraps instead of pushing the page sideways.
    <Badge variant="outline" className={cn('gap-1.5 rounded-md border-transparent', colors)}>
      <Icon aria-hidden="true" className="size-3.5 shrink-0" />
      <span>
        {display.state === 'sent' ? (
          // The visible text stays exactly display.label; the full timestamp sits in dateTime.
          <>
            {INVITATION_MESSAGES.stateSentOn}{' '}
            <time dateTime={display.sentAt}>{display.date}</time>
          </>
        ) : (
          display.label
        )}
      </span>
    </Badge>
  )
}
