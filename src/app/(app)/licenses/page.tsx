// Licence overview (docs/app-shell.md → Seitenmuster). PROJ-1 sets only the page header and a
// placeholder sentence; PROJ-2 fills the content. The page calls the guard as well, the frame
// alone is never enough. Unassigned (EC-5): nothing here, the notice comes from the frame.
import type { Metadata } from 'next'
import { requireTrainingProvider } from '@/features/account/session.data'

// The root template adds the product name: "Lizenzübersicht – Lizenzzentrale".
export const metadata: Metadata = { title: 'Lizenzübersicht' }

// Rendered per request (Cache-Control: no-store, AC-10).
export const dynamic = 'force-dynamic'

export default async function LicensesPage() {
  const admin = await requireTrainingProvider()
  if (admin.status !== 'assigned') return null

  return (
    <div className="flex flex-col gap-2">
      <h1 className="type-title">Lizenzübersicht</h1>
      <p className="type-body text-muted-foreground">
        Hier sehen Sie bald Ihr Kontingent und verwalten die Lizenzen Ihres Bildungsträgers.
      </p>
    </div>
  )
}
