// The guard of the signed-in area (design.md → Wächter, docs/app-shell.md). The layout, every
// page and every Server Action call it; the gate in src/proxy.ts alone is never enough.
// It reads only with the visitor's own session from the cookies, so Row Level Security decides
// what is visible. Rights come only from the membership row, never from user metadata or the
// token (design.md → Grundsätze 2) — which is why the admin client has no place here.
import 'server-only'
import { cache } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export type TrainingProvider = { id: string; name: string; licenseQuota: number }

export type CurrentAdmin =
  | { status: 'signed_out' }
  | { status: 'unassigned'; userId: string }
  | { status: 'assigned'; userId: string; role: 'admin'; trainingProvider: TrainingProvider }

// The project has no generated database types, and without them supabase-js types an embedded
// relation as an array. The foreign key makes it many-to-one, so PostgREST embeds one object,
// or null when Row Level Security hides the training provider.
type MembershipRow = {
  role: string
  training_providers: { id: string; name: string; license_quota: number } | null
}

/** Exactly one of three states, read once per request (React `cache`). */
export const getCurrentAdmin = cache(async (): Promise<CurrentAdmin> => {
  const supabase = await createClient()

  // getUser asks the Auth server, so a session ended elsewhere counts at once (EC-6). getSession
  // would only read the cookies, and the database keeps accepting the old token until it expires.
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()
  if (userError || !user) return { status: 'signed_out' }

  const { data, error } = await supabase
    .from('training_provider_members')
    .select('role, training_providers ( id, name, license_quota )')
    .eq('user_id', user.id)
    .maybeSingle()
    .overrideTypes<MembershipRow, { merge: false }>()
  // An outage is neither "unassigned" (EC-5) nor access: the page's error boundary takes over.
  if (error) throw new Error('Could not read the training provider membership.', { cause: error })

  const provider = data?.training_providers
  if (!data || data.role !== 'admin' || !provider) {
    return { status: 'unassigned', userId: user.id }
  }

  return {
    status: 'assigned',
    userId: user.id,
    role: 'admin',
    trainingProvider: { id: provider.id, name: provider.name, licenseQuota: provider.license_quota },
  }
})

/** Redirects to /login?reason=session when signed out; otherwise returns 'assigned' or 'unassigned'. Once per request. */
export const requireTrainingProvider = cache(
  async (): Promise<Exclude<CurrentAdmin, { status: 'signed_out' }>> => {
    const admin = await getCurrentAdmin()
    if (admin.status === 'signed_out') redirect('/login?reason=session')
    return admin
  }
)
