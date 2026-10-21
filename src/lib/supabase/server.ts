// Server-side Supabase client — Server Components, Server Actions, Route Handlers.
// One client per request: it reads and refreshes the session from the request's cookies.
// The two NEXT_PUBLIC_ values come from the env file at call time; nothing here runs at build.
import 'server-only'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
          } catch {
            // Called from a Server Component, which cannot set cookies. Harmless as long as
            // src/proxy.ts refreshes the session — see docs/stacks/backend-supabase.md.
          }
        },
      },
    }
  )
}
