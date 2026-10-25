// Frame of the signed-out area (docs/app-shell.md → Anmeldestatus): a centred card with the
// product name, full width with the page margin on a phone, about 400 px from md. Cards are set
// apart by their border, not a shadow (docs/design-system.md → Flächen).
import type { ReactNode } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'

export default function AuthLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <main className="flex min-h-dvh justify-center px-4 py-8 md:items-center md:px-6 md:py-12">
      <Card className="h-fit w-full shadow-none md:max-w-[400px]">
        <CardHeader className="p-4 pb-2 md:p-6 md:pb-2">
          <p className="type-title text-center">Lizenzzentrale</p>
        </CardHeader>
        <CardContent className="p-4 pt-0 md:p-6 md:pt-0">{children}</CardContent>
      </Card>
    </main>
  )
}
