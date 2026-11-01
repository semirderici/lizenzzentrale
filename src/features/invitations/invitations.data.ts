// Data access for sending an invitation (design.md → Versand einer Einladung, Grundsätze 2 to 5).
// The visibility check runs with the administrator's own session, so Row Level Security is the
// second check behind the database function's own training-provider check. The two functions
// from supabase/migrations/20261026150000_proj3_license_invitations.sql may only be executed by
// service_role; for them, and for nothing else, this module uses the admin client. A database
// error or an unexpected answer is an error result, never "allowed". Nothing filters by an
// address, and no address ever goes into an error or a log line (PROJ-2 QA, O-1).
import 'server-only'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export type LicenseVisibility = { status: 'visible' } | { status: 'not_visible' } | { status: 'error' }

/** availableFrom is an ISO string; email is the address exactly as the licence stores it. */
export type BeginInvitationResult =
  | { status: 'allowed'; sendId: number; email: string }
  | { status: 'not_found' }
  | { status: 'already_sending' }
  | { status: 'license_limit'; availableFrom: string }
  | { status: 'provider_limit'; availableFrom: string }
  | { status: 'error' }

const availableFrom = z.iso.datetime({ offset: true })

const beginAnswer = z.discriminatedUnion('status', [
  z.object({ status: z.literal('allowed'), send_id: z.number().int().positive(), email: z.string().min(1) }),
  z.object({ status: z.literal('license_not_found') }),
  z.object({ status: z.literal('already_sending') }),
  z.object({ status: z.literal('license_limit'), available_from: availableFrom }),
  z.object({ status: z.literal('provider_limit'), available_from: availableFrom }),
])

/**
 * Whether the administrator's session sees this licence of their training provider (design.md →
 * Senden, step 3). Not visible means revoked — or foreign, which looks the same (EC-5, AC-9).
 */
export async function isLicenseVisible(trainingProviderId: string, licenseId: string): Promise<LicenseVisibility> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('licenses')
      .select('id')
      .eq('id', licenseId)
      .eq('training_provider_id', trainingProviderId)
      .maybeSingle()
    if (error) return { status: 'error' }
    return data ? { status: 'visible' } : { status: 'not_visible' }
  } catch {
    return { status: 'error' }
  }
}

async function callFunction(fn: string, args: Record<string, unknown>) {
  try {
    const { data, error } = await createAdminClient().rpc(fn, args)
    return error ? { ok: false as const } : { ok: true as const, data: data as unknown }
  } catch {
    return { ok: false as const }
  }
}

/** Checks the limits and reserves the send; the recipient comes from the stored licence (AC-9, EC-8). */
export async function beginInvitation(trainingProviderId: string, licenseId: string): Promise<BeginInvitationResult> {
  const result = await callFunction('license_center_begin_invitation', {
    p_training_provider_id: trainingProviderId,
    p_license_id: licenseId,
  })
  if (!result.ok) return { status: 'error' }
  const answer = beginAnswer.safeParse(result.data)
  if (!answer.success) return { status: 'error' }
  switch (answer.data.status) {
    case 'allowed':
      return { status: 'allowed', sendId: answer.data.send_id, email: answer.data.email }
    case 'license_not_found':
      return { status: 'not_found' }
    case 'already_sending':
      return { status: 'already_sending' }
    case 'license_limit':
    case 'provider_limit':
      return {
        status: answer.data.status,
        availableFrom: new Date(answer.data.available_from).toISOString(),
      }
  }
}

/** true when the call went through; false on any error (the status then shows "Fehlgeschlagen" after 2 minutes, EC-3). */
export async function finishInvitation(sendId: number, accepted: boolean): Promise<boolean> {
  const result = await callFunction('license_center_finish_invitation', {
    p_send_id: sendId,
    p_accepted: accepted,
  })
  return result.ok
}
