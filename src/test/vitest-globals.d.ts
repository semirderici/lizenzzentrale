// Types the Vitest globals (`describe`, `it`, `expect`, `vi`) that vitest.config.ts enables with
// `globals: true`. Without this, a test written in the globals style passes Vitest and fails
// `next build`'s type check. Kept as a reference file rather than tsconfig `types`, because a
// `types` list switches off the automatic @types/* inclusion Next.js relies on.
/// <reference types="vitest/globals" />
