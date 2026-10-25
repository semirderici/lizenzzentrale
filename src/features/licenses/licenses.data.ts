// Data access for the licences of a training provider (design.md → Abläufe und Zugriff).
// Every query runs with the administrator's own session, so Row Level Security is the second
// check behind the training-provider filter here — which is why the admin client has no place
// here. Each function is exactly one statement, all or nothing (EC-5). Nothing ever filters by
// an address: Supabase logs Data-API URLs, and a participant's address must not end up there.
import 'server-only'
import { createClient } from '@/lib/supabase/server'

export type LicenseRow = { id: string; email: string; assignedAt: string }

export type ListLicensesResult = { status: 'ok'; licenses: LicenseRow[] } | { status: 'load_error' }

export type InsertLicenseResult =
  | { status: 'created'; id: string }
  | { status: 'already_assigned' }
  | { status: 'exhausted' }
  | { status: 'failed' }

export type DeleteLicenseResult = { status: 'revoked' } | { status: 'not_found' } | { status: 'failed' }

/**
 * All licences of the training provider, newest first; equal times ordered by id so the order
 * stays stable (design.md → Übersicht lesen). A failure is never an empty list (EC-6).
 */
export async function listLicenses(trainingProviderId: string): Promise<ListLicensesResult> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('licenses')
      .select('id, email, assigned_at')
      .eq('training_provider_id', trainingProviderId)
      .order('assigned_at', { ascending: false })
      .order('id', { ascending: false })
    if (error || !data) return { status: 'load_error' }
    return {
      status: 'ok',
      licenses: data.map((row) => ({ id: row.id, email: row.email, assignedAt: row.assigned_at })),
    }
  } catch {
    return { status: 'load_error' }
  }
}

/**
 * Assigns one licence (design.md → Zuweisen). The trigger decides quota and duplicates; the id
 * of the new licence comes back for PROJ-3, which starts the invitation from here.
 */
export async function insertLicense(trainingProviderId: string, email: string): Promise<InsertLicenseResult> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('licenses')
      .insert({ training_provider_id: trainingProviderId, email })
      .select('id')
      .single()
    if (error) {
      // From the trigger or, as the second line, from the unique key (AC-6, EC-2).
      if (error.code === '23505') return { status: 'already_assigned' }
      if (error.code === 'P0001' && error.message === 'license_quota_exhausted') return { status: 'exhausted' }
      // Also 42501: a foreign training provider looks like any other failure.
      return { status: 'failed' }
    }
    return { status: 'created', id: data.id }
  } catch {
    return { status: 'failed' }
  }
}

/**
 * Revokes one licence by its id and the training provider's id (design.md → Entziehen). No row
 * deleted means already revoked — or a foreign licence that RLS hides, which looks the same (EC-3).
 */
export async function deleteLicense(trainingProviderId: string, licenseId: string): Promise<DeleteLicenseResult> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('licenses')
      .delete()
      .eq('id', licenseId)
      .eq('training_provider_id', trainingProviderId)
      .select('id')
    if (error || !data) return { status: 'failed' }
    return data.length > 0 ? { status: 'revoked' } : { status: 'not_found' }
  } catch {
    return { status: 'failed' }
  }
}
