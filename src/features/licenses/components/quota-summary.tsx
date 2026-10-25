// Quota display of the licence overview (design.md → Regeln für Anzeige und Liste,
// docs/design-system.md → Kontingent-Anzeige): the numbers as text, the bar beside them, and the
// notice when no licence is free. The word carries the state, the icon only supports it.
import { Info, TriangleAlert } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import {
  assignedText,
  freeText,
  LICENSE_MESSAGES,
  QUOTA_NOTICE_ID,
  type QuotaSummary as Quota,
} from '../licenses.rules'

export function QuotaSummary({ summary }: { summary: Quota }) {
  const assigned = assignedText(summary)

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="flex flex-col gap-3 p-4 md:p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <p className="type-section tabular-nums">{assigned}</p>
            <p className="type-body tabular-nums text-muted-foreground">{freeText(summary)}</p>
          </div>
          {/* The screen reader reads the same text as the display, not a bare percentage. The
              installed Progress uses `value` only for the fill and does not pass it to Radix,
              so the values are set here. */}
          <Progress
            value={summary.percent}
            aria-label={LICENSE_MESSAGES.progressLabel}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={summary.percent}
            aria-valuetext={assigned}
            className="bg-muted"
          />
        </CardContent>
      </Card>

      {summary.state === 'available' ? null : (
        // The locked "Lizenz zuweisen" button points here for screen readers (AC-7, AC-9).
        <Alert id={QUOTA_NOTICE_ID}>
          {summary.state === 'exceeded' ? (
            <TriangleAlert aria-hidden="true" className="size-4" />
          ) : (
            <Info aria-hidden="true" className="size-4" />
          )}
          <AlertDescription className="type-body">
            {summary.state === 'exceeded'
              ? LICENSE_MESSAGES.quotaExceededNotice
              : LICENSE_MESSAGES.quotaExhaustedNotice}
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}
