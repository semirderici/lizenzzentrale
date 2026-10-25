// Notice of the signed-in frame for an account without a training provider (EC-5,
// docs/app-shell.md → Anmeldestatus). The sentence carries the status, the icon only supports it.
import { Info } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { MESSAGES } from '../account.rules'

export function UnassignedNotice() {
  return (
    <Alert>
      <Info aria-hidden="true" className="size-4" />
      <AlertDescription className="type-body">{MESSAGES.unassigned}</AlertDescription>
    </Alert>
  )
}
