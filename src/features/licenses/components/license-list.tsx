// The section "Vergebene Lizenzen" (design.md → Komponentenstruktur, Regeln für Anzeige und
// Liste): a table from md, one card per licence below it, or the empty state. Both versions are
// in the HTML; the hidden one is display: none, so screen readers read the list once. Addresses
// are plain text and may break anywhere, so nothing sticks out sideways (EC-8).
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
import {
  formatAssignedDate,
  LICENSE_MESSAGES,
  type QuotaSummary as Quota,
} from '../licenses.rules'
import { AssignLicenseDialog } from './assign-license-dialog'
import { RevokeLicenseDialog } from './revoke-license-dialog'

/** One licence as the page read it; the components never read data themselves. */
type License = { id: string; email: string; assignedAt: string }

const HEADING_ID = 'licenses-heading'
const BREAK_ANYWHERE = '[overflow-wrap:anywhere]'

function AssignedDate({ value }: { value: string }) {
  return <time dateTime={value}>{formatAssignedDate(value)}</time>
}

export function LicenseList({ licenses, summary }: { licenses: License[]; summary: Quota }) {
  // Empty and nothing free can only mean a quota of 0: then the section is left out (EC-4).
  if (licenses.length === 0 && summary.state !== 'available') return null

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
                  {/* PROJ-3 adds the invitation column before this one. */}
                  <TableHead className="w-px">
                    <span className="sr-only">{LICENSE_MESSAGES.columnAction}</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {licenses.map((license) => (
                  <TableRow key={license.id}>
                    <TableCell className={`type-body ${BREAK_ANYWHERE}`}>{license.email}</TableCell>
                    <TableCell className="type-body whitespace-nowrap tabular-nums">
                      <AssignedDate value={license.assignedAt} />
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
            {licenses.map((license) => (
              <li key={license.id}>
                <Card className="flex flex-col gap-3 p-4">
                  <div className="flex flex-col gap-1">
                    <p className={`type-body font-medium ${BREAK_ANYWHERE}`}>{license.email}</p>
                    <p className="type-small tabular-nums text-muted-foreground">
                      {LICENSE_MESSAGES.columnAssignedAt} <AssignedDate value={license.assignedAt} />
                    </p>
                  </div>
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
