// Server-side Supabase client with the secret server key (SUPABASE_SERVICE_ROLE_KEY).
// It bypasses Row Level Security, so it is used only for the brake functions, registering and the
// password check — never to read training provider or membership data (design.md → Code-Struktur).
// It keeps no session and sets no cookies. Create one per operation: after signInWithPassword a
// client sends the user's token instead of its own key.
import 'server-only'
import { createClient } from '@supabase/supabase-js'

export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
  )
}
