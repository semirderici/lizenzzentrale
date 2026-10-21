# lizenzzentrale

> Built with the AI Engineering Kit — a spec-driven workflow for your coding agent.

<!-- AI-ENG-KIT:START (managed — do not edit by hand; refreshed by /verify-setup) -->
## AI Engineering Workflow

This project uses the AI Engineering Kit — a spec-driven workflow. Development runs in phases, each driven by a skill:

`/init → /write-spec → /architecture → /tasks → /build → /qa → /deploy`   (`/refine` & `/audit` anytime · `/dsgvo` when personal data is involved · `/e2e-tests` for critical flows · `/security-check` & `/cleanup` after `/deploy`)

- **Feature specs** live in `features/PROJ-X-name/`: `spec.md` (the contract — WHAT), `design.md` (the technical design — HOW), `tasks.md` (the ordered build plan), `qa-report.md` (the test report).
- **Acceptance Criteria** carry stable IDs (`AC-1`, `AC-2`, …). The chain is **AC → Task → Test**.
- **Project status** is tracked in `features/INDEX.md`.
- `spec.md` is **read-only during `/build`** — it is the stable contract.
- **One working language** for the whole project — the conversation *and* every document the skills write, acceptance criteria included. It is recorded under Key Conventions below.

@.claude/rules/general.md
@.claude/rules/security.md
<!-- AI-ENG-KIT:END -->

## Tech Stack

- **Framework:** Next.js 16 (App Router), TypeScript
- **Styling:** Tailwind CSS + shadcn/ui (copy-paste components)
- **Backend:** Supabase (PostgreSQL + Auth + Storage) - optional
- **Deployment:** Vercel or Hostinger (GitHub-connected auto-deploy)
- **Validation:** Zod + react-hook-form
- **State:** React useState / Context API

## Project Structure

```
src/
  app/              Pages (Next.js App Router)
  features/         Feature implementation: UI, rules, data and integrations together
  components/
    ui/             shadcn/ui components (NEVER recreate these)
  hooks/            Custom React hooks
  lib/              Named shared infrastructure (supabase/) and small shared utilities
supabase/           Created by `supabase init` in /init when the backend is Supabase
  migrations/       Schema changes as .sql files (one per change)
tests/              Playwright E2E tests (added by /e2e-tests)
features/           Feature specs, one folder per feature
  PROJ-X-name/      spec.md, design.md, tasks.md, qa-report.md
  INDEX.md          Feature status overview
docs/
  PRD.md            Product Requirements Document
  data-model.md     App-wide data model (entities + relationships); built by /init, refined by /architecture
  app-shell.md      App-wide frame (navigation, layout regions, page pattern); built by /init, refined by /architecture
  privacy.md        What personal data the product processes, why, how long; kept current by /dsgvo
  tech-debt.md      Internal work with a status (refactorings, coverage, cleanup); fed by /map, worked by /refactor
  kit/CHANGELOG.md  The AI Engineering Kit's own release history. Kit-authored; replaced on update.
  production/       Topic guides: error tracking, security headers, rate limiting, performance, DB
  stacks/           Stack packs — the concrete procedures for this project's stack, read by the
                    skills when they need a command or a path. Kit-authored; replaced on update.
```

## Key Conventions

- **Code structure and checks:** Follow the Next.js pack's feature/module convention. `npm run check`
  is the final build check; targeted tests remain the inner loop. See `docs/stacks/framework-nextjs.md`.

- **Working language: Deutsch.** Talk to the user in Deutsch and write every project document in Deutsch — see `.claude/rules/general.md` → Working Language.
- **Feature IDs:** PROJ-1, PROJ-2, etc. (sequential)
- **Commits:** `feat(PROJ-X): description`, `fix(PROJ-X): description`
- **Single Responsibility:** One feature per folder
- **Feature branches:** you create a branch `feat/PROJ-X-name` before `/build`; work stays there through build/QA/E2E, and `/deploy` merges it into `main` to go live. `main` always stays deployable.
- **shadcn/ui first:** NEVER create custom versions of installed shadcn components
- **App shell:** navigation, layout regions, and the page pattern live in `docs/app-shell.md` and belong to the feature recorded there. Reuse those components — never add a second sidebar, header, or nav inside a feature. Changing how the shell behaves is a `/refine` on its owning feature.
- **Parallel build:** `/build` runs file-disjoint [P] tasks from `tasks.md` as isolated subagents
- **Human-in-the-loop:** All workflows have user approval checkpoints
- **Secrets / env files:** Never read, edit, or create `.env.local` (it's permission-blocked and holds your private keys). To document a variable, add a placeholder to `.env.local.example` (the one env file the agent may edit). When a real value is needed, the agent asks you in chat what to paste into `.env.local` — it never writes it itself.
- **Tests:** Unit tests co-located next to source files (`useHook.test.ts` next to `useHook.ts`), written by `/qa`. E2E tests live in `tests/`, added on demand by `/e2e-tests` for critical core journeys only.
- **Supabase environments:** The test-vs-live strategy (`local` / `two-projects` / `single` / `branching`) is chosen at `/init` and recorded in `docs/PRD.md` → Constraints. Default is **`local`** — Supabase runs in Docker while you build, then migrates to a hosted live project at `/deploy` (`supabase db push`). `.env.local` always holds **test** keys, never live. Schema changes are captured as `supabase/migrations/*.sql` and promoted to production at `/deploy`.

## Build & Test Commands

```bash
npm run dev          # Development server (localhost:3000)
npm run build        # Production build
npm run lint         # ESLint
npm run start        # Production server
npm test             # Vitest unit/integration tests
npm run test:e2e     # Playwright E2E tests
npm run test:all     # Both test suites
```

## Product Context

@docs/PRD.md

## Data Model

@docs/data-model.md

## Feature Overview

@features/INDEX.md
