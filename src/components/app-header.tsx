// Header of the signed-in area (docs/app-shell.md). Gets the training provider's name as a value
// and imports nothing from src/features. Without a name (EC-5) only "Abmelden" stays on the right.
import { Button } from '@/components/ui/button'

export function AppHeader({ trainingProviderName }: { trainingProviderName?: string | null }) {
  return (
    <header className="border-b bg-card">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 md:px-6 lg:px-8">
        <span className="shrink-0 font-semibold">Lizenzzentrale</span>
        <div className="ml-auto flex min-w-0 items-center gap-2 md:gap-4">
          {trainingProviderName ? (
            // Plain text, one line, cut with "…"; the full name as a tooltip (EC-10).
            <span
              className="min-w-0 truncate type-small text-muted-foreground"
              title={trainingProviderName}
            >
              {trainingProviderName}
            </span>
          ) : null}
          {/* Native POST: the browser reloads /login completely afterwards (AC-10). */}
          <form action="/sign-out" method="post" className="shrink-0">
            <Button type="submit" variant="ghost" className="h-11 min-w-11 px-3">
              Abmelden
            </Button>
          </form>
        </div>
      </div>
    </header>
  )
}
