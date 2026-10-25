// Frame of the signed-in area (docs/app-shell.md). Calls the guard itself; every page calls it
// again, and the gate in src/proxy.ts alone is never enough. Unassigned (EC-5): the header
// without a name and only the notice, no feature page at all.
import type { ReactNode } from 'react'
import { AppHeader } from '@/components/app-header'
import { UnassignedNotice } from '@/features/account/components/unassigned-notice'
import { requireTrainingProvider } from '@/features/account/session.data'

// Rendered per request, so Next.js sends Cache-Control: no-store and no browser keeps a
// protected page for going back after signing out (AC-10).
export const dynamic = 'force-dynamic'

export default async function AppLayout({ children }: Readonly<{ children: ReactNode }>) {
  const admin = await requireTrainingProvider()

  return (
    <>
      <AppHeader
        trainingProviderName={admin.status === 'assigned' ? admin.trainingProvider.name : null}
      />
      {/* Same container as the header, so both line up (docs/design-system.md → Abstände). */}
      <main className="mx-auto max-w-6xl px-4 py-8 md:px-6 md:py-12 lg:px-8">
        {admin.status === 'assigned' ? children : <UnassignedNotice />}
      </main>
    </>
  )
}
