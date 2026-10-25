'use client'
// The licences could not be read (EC-6, design.md → Übersicht lesen, Technische Entscheidungen).
// Under the title the page shows only this box, never an empty list or "0 von 5". "Erneut
// versuchen" reloads through the router, not the browser (docs/app-shell.md → Seitenmuster).
import { CircleAlert } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { LICENSE_MESSAGES } from '../licenses.rules'

export function LicensesLoadError() {
  const router = useRouter()
  const [retrying, startTransition] = useTransition()

  return (
    <Alert variant="destructive">
      <CircleAlert aria-hidden="true" className="size-4" />
      <AlertDescription className="type-body">{LICENSE_MESSAGES.loadFailed}</AlertDescription>
      <div className="mt-3">
        <Button
          type="button"
          variant="outline"
          className="h-11"
          disabled={retrying}
          aria-busy={retrying}
          onClick={() => startTransition(() => router.refresh())}
        >
          {LICENSE_MESSAGES.retry}
        </Button>
      </div>
    </Alert>
  )
}
