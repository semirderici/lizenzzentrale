// The section "Vergebene Lizenzen" (design.md → Komponentenstruktur, Regeln für Anzeige und
// Liste): a table from md, one card per licence below it, or the empty state. Both versions are
// in the HTML; the hidden one is display: none, so screen readers read the list once. Addresses
// are plain text and may break anywhere, so nothing sticks out sideways (EC-8).
// PROJ-3 adds the column "Einladung" (card: the line "Einladung:"): the state of the last
// invitation as a badge and, unless it is still being sent, the button to send it. The state is
// computed here from the row and the server's time at render (`now`), once per licence, so table
// and card always agree (PROJ-3 design.md → Lizenzübersicht, Versandstand in der Liste).
import { KeyRound } from 'lucide-react'
import { Card } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { InvitationStatus } from '@/features/invitations/components/invitation-status'
import { SendInvitationButton } from '@/features/invitations/components/send-invitation-button'
import {
  INVITATION_MESSAGES,
  invitationDisplay,
  type InvitationDisplay,
  type InvitationState,
} from '@/features/invitations/invitations.rules'
import {
  formatAssignedDate,
  LICENSE_MESSAGES,
  type QuotaSummary as Quota,
} from '../licenses.rules'
import { AssignLicenseDialog } from './assign-license-dialog'
import { RevokeLicenseDialog } from './revoke-license-dialog'

/** One licence as the page read it; the components never read data themselves. */
type License = { id: string; email: string; assignedAt: string; invitation: InvitationState }

const HEADING_ID = 'licenses-heading'
const BREAK_ANYWHERE = '[overflow-wrap:anywhere]'

function AssignedDate({ value }: { value: string }) {
  return <time dateTime={value}>{formatAssignedDate(value)}</time>
}

/** "Einladung senden" / "Erneut senden", or nothing while the invitation is being sent. */
function SendButton({
  license,
  invitation,
  appearance,
}: {
  license: License
  invitation: InvitationDisplay
  appearance: 'compact' | 'full'
}) {
  if (invitation.action === null) return null
  return (
    <SendInvitationButton
      licenseId={license.id}
      email={license.email}
      action={invitation.action}
      appearance={appearance}
    />
  )
}

export function LicenseList({
  licenses,
  summary,
  now,
}: {
  licenses: License[]
  summary: Quota
  /** The server's time at render: a send still "sending" after 2 minutes shows as failed (EC-3). */
  now: Date
}) {
  // Empty and nothing free can only mean a quota of 0: then the section is left out (EC-4).
  if (licenses.length === 0 && summary.state !== 'available') return null

  const rows = licenses.map((license) => ({ license, invitation: invitationDisplay(license.invitation, now) }))

  return (
    <section aria-labelledby={HEADING_ID} className="flex flex-col gap-4">
      <h2 id={HEADING_ID} className="type-section">
        {LICENSE_MESSAGES.listSection}
      </h2>

      {licenses.length === 0 ? (
        <Card className="flex flex-col items-center gap-4 p-6 text-center md:p-8">
          <KeyRound aria-hidden="true" className="size-8 text-muted-foreground" />
          <p className="type-body text-muted-foreground">{LICENSE_MESSAGES.emptyList}</p>
          <AssignLicenseDialog disabled={false} variant="empty" />
        </Card>
      ) : (
        <>
          <Card className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{LICENSE_MESSAGES.columnEmail}</TableHead>
                  <TableHead className="whitespace-nowrap">{LICENSE_MESSAGES.columnAssignedAt}</TableHead>
                  <TableHead>{INVITATION_MESSAGES.columnInvitation}</TableHead>
                  <TableHead className="w-px">
                    <span className="sr-only">{LICENSE_MESSAGES.columnAction}</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(({ license, invitation }) => (
                  <TableRow key={license.id}>
                    <TableCell className={`type-body ${BREAK_ANYWHERE}`}>{license.email}</TableCell>
                    <TableCell className="type-body whitespace-nowrap tabular-nums">
                      <AssignedDate value={license.assignedAt} />
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-2">
                        <InvitationStatus display={invitation} />
                        <SendButton license={license} invitation={invitation} appearance="compact" />
                      </div>
                    </TableCell>
                    <TableCell className="w-px text-right">
                      <RevokeLicenseDialog licenseId={license.id} email={license.email} appearance="compact" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          <ul className="flex flex-col gap-3 md:hidden">
            {rows.map(({ license, invitation }) => (
              <li key={license.id}>
                <Card className="flex flex-col gap-3 p-4">
                  <div className="flex flex-col gap-1">
                    <p className={`type-body font-medium ${BREAK_ANYWHERE}`}>{license.email}</p>
                    <p className="type-small tabular-nums text-muted-foreground">
                      {LICENSE_MESSAGES.columnAssignedAt} <AssignedDate value={license.assignedAt} />
                    </p>
                    {/* A div, not a p: the badge is a div, and a div inside a p breaks hydration. */}
                    <div className="type-small flex flex-wrap items-center gap-x-2 gap-y-1 text-muted-foreground">
                      {INVITATION_MESSAGES.cardLabel} <InvitationStatus display={invitation} />
                    </div>
                  </div>
                  <SendButton license={license} invitation={invitation} appearance="full" />
                  <RevokeLicenseDialog licenseId={license.id} email={license.email} appearance="full" />
                </Card>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
