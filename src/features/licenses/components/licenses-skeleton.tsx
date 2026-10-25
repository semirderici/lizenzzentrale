// Skeletons in the shape of the licence overview (docs/app-shell.md → Seitenmuster, Laden):
// the real title, then the main action, the quota display and three rows of the list. Same
// wrapper and header row as src/app/(app)/licenses/page.tsx, so nothing jumps when it loads.
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { LICENSE_MESSAGES } from '../licenses.rules'

export function LicensesSkeleton() {
  return (
    <div aria-busy="true" className="flex flex-col gap-8 md:gap-12">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <h1 className="type-title">{LICENSE_MESSAGES.pageTitle}</h1>
        <Skeleton className="h-11 w-full md:w-40" />
      </div>

      <Card className="flex flex-col gap-3 p-4 md:p-6">
        <Skeleton className="h-7 w-64 max-w-full" />
        <Skeleton className="h-4 w-full" />
      </Card>

      <div className="flex flex-col gap-4">
        <Skeleton className="h-7 w-48 max-w-full" />
        {[0, 1, 2].map((row) => (
          <Skeleton key={row} className="h-14 w-full" />
        ))}
      </div>
    </div>
  )
}
