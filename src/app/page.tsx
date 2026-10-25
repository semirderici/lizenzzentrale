// The start address only forwards, on the server and before anything renders (AC-9,
// docs/app-shell.md → Bereiche). Signed in, the frame of /licenses handles "unassigned" (EC-5).
import { redirect } from 'next/navigation'
import { getCurrentAdmin } from '@/features/account/session.data'

// Rendered per request: the target depends on the visitor's session.
export const dynamic = 'force-dynamic'

export default async function Home() {
  const admin = await getCurrentAdmin()
  redirect(admin.status === 'signed_out' ? '/login' : '/licenses')
}
