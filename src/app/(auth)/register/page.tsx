// Register (design.md → Seiten und Rahmen). The gate sends signed-in visitors on to /licenses.
import type { Metadata } from 'next'
import Link from 'next/link'
import { RegisterForm } from '@/features/account/components/register-form'

export const metadata: Metadata = { title: 'Registrieren' }

export default function RegisterPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="type-section text-center">Registrieren</h1>
      <RegisterForm />
      <Link
        href="/login"
        className="inline-flex min-h-11 items-center justify-center rounded-md type-small text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        Schon registriert? Anmelden
      </Link>
    </div>
  )
}
