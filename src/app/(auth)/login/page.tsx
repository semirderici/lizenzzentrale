// Login (design.md → Seiten und Rahmen). The notice "Bitte melden Sie sich erneut an." appears
// only for ?reason=session exactly, always as the same fixed text; the value from the address
// is never shown (EC-6). The gate sends signed-in visitors on to /licenses.
import type { Metadata } from 'next'
import Link from 'next/link'
import { LoginForm } from '@/features/account/components/login-form'

export const metadata: Metadata = { title: 'Anmelden' }

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { reason } = await searchParams

  return (
    <div className="flex flex-col gap-6">
      <h1 className="type-section text-center">Anmelden</h1>
      <LoginForm sessionEnded={reason === 'session'} />
      <Link
        href="/register"
        className="inline-flex min-h-11 items-center justify-center rounded-md type-small text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        Noch kein Konto? Registrieren
      </Link>
    </div>
  )
}
