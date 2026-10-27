// Licence overview (docs/app-shell.md → Seitenmuster, PROJ-2 design.md → Übersicht lesen). The
// page calls the guard as well, the frame alone is never enough. Unassigned (EC-5): nothing here,
// the notice comes from the frame. The licences are read with the administrator's session on
// every request; after an action, refresh() renders this page again with fresh numbers (AC-1).
import type { Metadata } from 'next'
import { requireTrainingProvider } from '@/features/account/session.data'
import { AssignLicenseDialog } from '@/features/licenses/components/assign-license-dialog'
import { LicenseList } from '@/features/licenses/components/license-list'
import { LicensesLoadError } from '@/features/licenses/components/licenses-load-error'
import { QuotaSummary } from '@/features/licenses/components/quota-summary'
import { listLicenses } from '@/features/licenses/licenses.data'
import { LICENSE_MESSAGES, quotaSummary } from '@/features/licenses/licenses.rules'

// The root template adds the product name: "Lizenzübersicht – Lizenzzentrale".
export const metadata: Metadata = { title: LICENSE_MESSAGES.pageTitle }

// Rendered per request (Cache-Control: no-store, PROJ-1 AC-10).
export const dynamic = 'force-dynamic'

export default async function LicensesPage() {
  const admin = await requireTrainingProvider()
  if (admin.status !== 'assigned') return null

  const result = await listLicenses(admin.trainingProvider.id)

  // Never an empty list or "0 von 5" as if nothing were assigned (EC-6).
  if (result.status === 'load_error') {
    return (
      <div className="flex flex-col gap-8 md:gap-12">
        <h1 className="type-title">{LICENSE_MESSAGES.pageTitle}</h1>
        <LicensesLoadError />
      </div>
    )
  }

  // The quota comes from the guard, read in the same request (EC-10).
  const summary = quotaSummary(result.licenses.length, admin.trainingProvider.licenseQuota)
  // The server's time right after reading: the list derives each invitation's state from it (PROJ-3 EC-3).
  const now = new Date()

  return (
    <div className="flex flex-col gap-8 md:gap-12">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <h1 className="type-title">{LICENSE_MESSAGES.pageTitle}</h1>
        {/* Only the database decides; the locked button only spares a pointless try (AC-7, AC-9). */}
        <AssignLicenseDialog disabled={summary.state !== 'available'} variant="main" />
      </div>
      <QuotaSummary summary={summary} />
      <LicenseList licenses={result.licenses} summary={summary} now={now} />
    </div>
  )
}
