import { defineConfig, configDefaults } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

// .mts on purpose: package.json is CommonJS, and Vite warns when an ESM config is loaded as CJS.
export default defineConfig({
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
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
