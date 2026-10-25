import { defineConfig, configDefaults } from 'vitest/config'
import { loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

// .mts on purpose: package.json is CommonJS, and Vite warns when an ESM config is loaded as CJS.
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    // A fresh scaffold ships no tests yet — `npm test` must not fail before
    // /build and /qa have written the first ones.
    passWithNoTests: true,
    // tests/ holds the Playwright specs (playwright.config.ts → testDir). Vitest's default
    // include pattern would collect them too and fail on the first one /e2e-tests writes.
    exclude: [...configDefaults.exclude, 'tests/**'],
    // The integration tests talk to the hosted Supabase project and read its keys from
    // .env.local, as `next dev` does. Only the prefixes the app uses are loaded.
    env: loadEnv(mode, process.cwd(), ['NEXT_PUBLIC_', 'SUPABASE_', 'TURNSTILE_']),
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // `server-only` throws outside a React Server Components bundle. Tests import the
      // server modules directly, so they get the package's own empty entry instead.
      'server-only': fileURLToPath(new URL('./node_modules/server-only/empty.js', import.meta.url)),
    },
  },
}))
