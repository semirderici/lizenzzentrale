'use client'
// What the login and register forms and the licence dialogs share (docs/app-shell.md →
// Gemeinsame Bausteine): the field error with its icon, the form error box, and telling the
// redirect after a success apart from a real failure. Shared code imports nothing from a feature,
// so the box takes its message as plain text.
import { CircleAlert } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { FormMessage, useFormField } from '@/components/ui/form'

/** The field's error under the field, as text with an icon — never only a red border. */
export function FieldMessage() {
  const { error } = useFormField()
  if (!error) return null
  return (
    <div className="flex items-start gap-1.5 text-destructive">
      <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <FormMessage className="type-small font-normal" />
    </div>
  )
}

/** A form error stays until the next attempt, so it is a box, not a toast. */
export function FormAlert({ message, children }: { message: string; children?: React.ReactNode }) {
  return (
    <Alert variant="destructive">
      <CircleAlert aria-hidden="true" className="size-4" />
      <AlertDescription className="type-small">
        {message}
        {children}
      </AlertDescription>
    </Alert>
  )
}

/**
 * After `redirect()` in a Server Action, Next.js rejects the call on the client with this error
 * while it navigates to the target. It means success, never "Keine Verbindung" (EC-9).
 */
export function isRedirectError(error: unknown) {
  const digest = (error as { digest?: unknown } | null)?.digest
  return typeof digest === 'string' && digest.startsWith('NEXT_REDIRECT')
}

/** No answer from the app server at all: fetch fails with a TypeError (EC-9). */
export function isConnectionError(error: unknown) {
  return error instanceof TypeError
}
