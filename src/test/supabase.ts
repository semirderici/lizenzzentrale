// Helpers for the integration tests against the hosted Supabase project (strategy `single`).
// Test accounts are created and signed in through the admin key, because the Supabase CAPTCHA
// (tasks.md T18) rejects every sign-in with the public key. Each test file deletes what it created
// with deleteTestAccounts() in afterAll.
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'

const clientOptions = {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
}

const createdUserIds = new Set<string>()

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is missing in .env.local (see README)`)
  return value
}

export function createAdminTestClient() {
  return createClient(
    requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
    clientOptions
  )
}

/** A visitor without a session, holding only the public key. */
export function createAnonTestClient() {
  return createClient(
    requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    clientOptions
  )
}

/** The public key plus a test account's access token: what a signed-in administrator holds. */
export function createUserTestClient(accessToken: string) {
  return createClient(
    requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    { ...clientOptions, accessToken: async () => accessToken }
  )
}

export function uniqueEmail(label = 'account') {
  return `lizenzzentrale-test-${label}-${randomUUID()}@example.com`
}

export function uniquePassword() {
  return `Test-${randomUUID()}`
}

/** Deletes the account in afterAll, also when the test created it without createTestAccount. */
export function registerForCleanup(userId: string) {
  createdUserIds.add(userId)
}

export type TestAccount = {
  userId: string
  email: string
  password: string
  accessToken: string
}

export async function createTestAccount(
  options: { email?: string; userMetadata?: Record<string, unknown> } = {}
): Promise<TestAccount> {
  const email = options.email ?? uniqueEmail()
  const password = uniquePassword()
  const { data, error } = await createAdminTestClient().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: options.userMetadata ?? { training_provider_name: 'Testakademie' },
  })
  if (error) throw error
  registerForCleanup(data.user.id)

  const accessToken = await signInAsTestAccount(email, password)
  return { userId: data.user.id, email, password, accessToken }
}

export async function signInAsTestAccount(email: string, password: string) {
  // A fresh client for every sign-in: after signInWithPassword a client sends the user's token
  // instead of its own key, which would quietly turn the admin client into a user client.
  const { data, error } = await createAdminTestClient().auth.signInWithPassword({ email, password })
  if (error) throw error
  return data.session.access_token
}

export async function deleteTestAccounts() {
  const admin = createAdminTestClient()
  for (const userId of createdUserIds) {
    const { error } = await admin.auth.admin.deleteUser(userId)
    if (error && error.status !== 404) throw error
    createdUserIds.delete(userId)
  }
}
