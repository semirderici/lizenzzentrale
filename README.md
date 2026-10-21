# AI Engineering Kit

> A spec-driven workflow for [Claude Code](https://docs.anthropic.com/en/docs/claude-code): turn an idea into a production-ready web app, one feature at a time — Requirements → Architecture → Tasks → Build → QA → Deploy.

This project was created with `npx create-ai-eng-app`. It ships a complete Next.js stack plus a set of Claude Code **Skills**, **Rules**, and **Sub-Agents** that drive each phase of the work. You steer; the skills do the heavy lifting and keep everything traceable.

**The AI Engineering Kit is the exclusive framework of the AI Engineering Accelerator** — Alex Sprogis' program that takes you from vibe-coder to AI engineer: shipping SaaS applications that are production-ready, secure, and good enough to sell.

---

## Quick Start

The scaffolder already ran `npm install` and a setup check. Open this project in the coding agent you installed it for — `.ai-eng-kit` → `agents` says which — and:

```
/verify-setup     Confirm the stack is wired and finish anything missing
/init             Define your product and a prioritized feature map
```

> **Codex writes these differently:** `$verify-setup`, `$init` — or pick them from the `/skills` menu.
> Every other agent uses `/`. Unsure? Run `/help` (or `$help`); it prints the syntax for this project.

`/init` runs a **discovery interview**, one question at a time (always with a recommended answer you confirm or correct), then writes your **PRD** (`docs/PRD.md`) and a prioritized **feature map** (`features/INDEX.md`). From there you build feature by feature.

```bash
npm run dev       # Start the dev server → http://localhost:3000
```

---

## The Workflow

Development runs in phases, each driven by a skill. Handoffs are always user-initiated — a skill suggests the next step, you run it when ready.

```
/init  →  /write-spec  →  /architecture  →  /tasks  →  /build  →  /qa  →  /deploy

         /refine PROJ-X   change or extend any feature, anytime
         /e2e-tests        after /qa, lock in critical user journeys (optional)
         /help             where am I, what's next?
```

| Skill | Command | What it does |
|-------|---------|--------------|
| Setup Check | `/verify-setup` | Verifies the stack, auto-fixes what's safe, reports what needs you (e.g. Supabase keys) |
| Codebase Map | `/map` | For a project that already exists: writes what it is built with, how it is put together, its weak spots and a proposed feature map to `docs/codebase/` — evidence with file paths, read by `/init` |
| Reverse Spec | `/reverse-spec` | For a feature that already runs: reads the criteria off the code, you confirm them block by block, `/qa` then verifies — the regression net a grown project is missing |
| Refactor | `/refactor` | Splits one oversized, mixed-responsibility file into modules behind an unchanged facade — only where verified specs can prove behaviour survived |
| Project Initializer | `/init` | One-time setup: creates the PRD + feature map via the discovery interview |
| Feature Spec Writer | `/write-spec` | Writes a full spec for one feature (user stories, acceptance criteria, edge cases) |
| Spec Refiner | `/refine PROJ-X` | Reopens an existing spec to change, extend (small or large) or challenge it — every change to a feature goes here, not into a new spec. Also folds several follow-up specs of one feature into one |
| Solution Architect | `/architecture` | Designs a PM-friendly technical approach (decisions, no code) |
| Task Planner | `/tasks` | Breaks the design into an ordered, leveled, parallelizable task list |
| Builder | `/build` | Implements the feature end to end — schema, API, UI — working through `tasks.md` |
| QA Engineer | `/qa` | Tests against acceptance criteria, writes unit tests, re-runs the build's integration tests as regression, runs a security audit |
| E2E Test Engineer | `/e2e-tests` | Optional: Playwright tests for the few critical journeys that must never break |
| DevOps | `/deploy` | Deploys to your host (Vercel or Hostinger) with production-ready checks and database promotion |
| Help | `/help` | Context-aware guide: shows where you are and what to do next |
| Audit | `/audit` | Anytime drift check: confirms INDEX, specs, the AC→Task→Test chain, and code all still match |
| Security Check | `/security-check` | Non-destructive check of the live app: HTTPS, security headers, protected routes, no exposed secrets, Supabase RLS |

---

## Spec-Driven Core

Every feature lives in its own folder `features/PROJ-X-name/`:

| File | Created by | Role |
|------|-----------|------|
| `spec.md` | `/write-spec` | The **contract** — WHAT the feature does. Read-only during `/build`. |
| `design.md` | `/architecture` | The **technical design** — HOW it's built. |
| `tasks.md` | `/tasks` | The **ordered build plan**, with file-disjoint `[P]` tasks for parallel work. |
| `qa-report.md` | `/qa` | The **test report**, keyed by acceptance-criterion ID. |

**AC-IDs are the traceability backbone.** Every acceptance criterion in `spec.md` gets a stable ID (`AC-1`, `AC-2`, …; edge cases `EC-1`, …). Tasks reference the AC-IDs they fulfill, and `qa-report.md` reports per AC-ID — chaining **AC → Task → Test**.

**Native parallel build.** `/build` works `tasks.md` level by level. Within a level, file-disjoint `[P]` tasks fan out to parallel sub-agents (each isolated in its own git worktree); the main agent then integrates, verifies against the level's AC-IDs, and advances. No special tool or keyword — it runs in any Claude Code session.

---

## Test vs. Live Data (Supabase)

So you never develop against real user data, `/init` asks how you want to separate environments and records the choice in `docs/PRD.md` → Constraints. Every later skill reads it from there.

| Strategy | What it means | Cost |
|----------|---------------|------|
| **local** *(recommended, default)* | Supabase runs on your machine via **Docker** while you build; the schema is migrated to a hosted live project at `/deploy`. Needs Docker + the Supabase CLI. | Free |
| **two-projects** | A separate hosted **dev** project to test in and a **prod** project for real users. No Docker needed. | Free tier covers both |
| **single** | One hosted Supabase project — test and live are the same. Simplest, but no safety net. | Free |
| **branching** | One Pro project with an always-on **staging** branch, promoted to live with a Merge. | Supabase Pro (~$35/mo) |

`.env.local` always holds your **test** keys (local Docker instance / dev project / staging branch / the single project) — never live keys. Schema changes are captured as `supabase/migrations/*.sql` and promoted to production during `/deploy` (`supabase db push` for `local`). For `branching`, `/deploy` previews the schema diff in plain language and flags anything destructive before you Merge.

Building frontend-only (no backend)? `/init` records "localStorage only" and skips all of the above.

---

## Feature Tracking

All features are tracked in `features/INDEX.md`. Each row links to the feature **folder**:

| ID | Feature | Status | Spec |
|----|---------|--------|------|
| PROJ-1 | User Login | Deployed | [Folder](features/PROJ-1-user-login/) |
| PROJ-2 | Dashboard | In Progress | [Folder](features/PROJ-2-dashboard/) |

Status flow: **Roadmap → Planned → Architected → Tasked → In Progress → In Review → Approved → Deployed**. Every skill reads this file at start and updates it when done, preventing duplicate work.

---

## Tech Stack

| Category | Tool | Why |
|----------|------|-----|
| **Framework** | Next.js 16 (App Router) | React + Server Components |
| **Language** | TypeScript | Type safety |
| **Styling** | Tailwind CSS | Utility-first CSS |
| **UI Library** | shadcn/ui | Copy-paste, customizable components |
| **Backend** | Supabase (optional) | PostgreSQL + Auth + Storage |
| **Deployment** | Vercel or Hostinger | GitHub-connected auto-deploy |
| **Validation** | Zod + react-hook-form | Runtime validation |
| **Testing** | Vitest + Playwright | Unit/integration + E2E |

---

## Project Structure

```
.
├── CLAUDE.md / AGENTS.md           Auto-loaded project context (map + managed block)
│                                   Exactly one of them carries content — see below
├── .claude/                        (Claude Code; other agents use their own folder)
│   ├── settings.json               Permissions (committed)
│   ├── rules/                      Auto-applied rules
│   │   ├── general.md                  Git workflow, feature tracking, status updates
│   │   └── security.md                 Secrets, headers, auth
│   ├── skills/                     Invocable workflows (/command) — one folder per skill:
│   │   │                           verify-setup, init, write-spec, refine, architecture, tasks,
│   │   │                           build, qa, e2e-tests, deploy, security-check, dsgvo, audit,
│   │   │                           cleanup, help, map, reverse-spec, refactor, starter-kit-migration
│   │   └── <skill>/SKILL.md
│   └── agents/
│       └── qa-engineer.md          Sub-agent config (model, tools, limits)
├── features/                       One folder per feature
│   ├── INDEX.md                        Status tracking
│   ├── README.md                       Feature-folder format
│   └── PROJ-X-name/                    spec.md · design.md · tasks.md · qa-report.md
├── docs/
│   ├── PRD.md                       Product Requirements Document
│   ├── data-model.md                App-wide data model (entities + relationships)
│   ├── app-shell.md                 Navigation, layout regions, page pattern
│   ├── privacy.md                   What personal data the product processes (kept by /dsgvo)
│   ├── tech-debt.md                 Internal work with a status (fed by /map, worked by /refactor)
│   ├── production/                  Topic guides: error tracking, headers, rate limiting, performance
│   ├── stacks/                      Stack packs — the concrete procedures for this project's stack
│   └── law/                         Law packs — GDPR, Swiss DSG, EU AI Act (read by /dsgvo)
├── supabase/                       Created by `supabase init` in /init when the backend is Supabase
│   └── migrations/                  Schema changes as .sql files
├── tests/                          Playwright E2E tests (added by /e2e-tests)
├── src/
│   ├── app/                        Pages (Next.js App Router)
│   ├── components/ui/              shadcn/ui components (never recreate these)
│   ├── hooks/                      Custom React hooks
│   └── lib/                        Utilities (supabase/server.ts + client.ts, utils.ts)
└── public/                         Static files
```

---

## How It Works Under the Hood

- **Skills** are structured workflows your agent discovers automatically. Most run inline (live interview / oversight); `/build` forks isolated sub-agents for parallel tasks, and `/qa` hands verification to `qa-engineer` sub-agents that have never seen the build. Where your agent has no sub-agents, `/build` works sequentially and `/qa` asks for a fresh session instead — the verifier must not know how the feature was built.
- **Rules** are the project-wide standards — workflow discipline, git conventions, working language, security. They are loaded in every session, so they apply to every skill without anyone loading them by hand.
- **The memory file** is auto-loaded every session with the tech stack, conventions, and pointers to the PRD and feature index.

**Where those live depends on your agent** — same content, each in the place that agent reads:

| agent | skills | rules |
|---|---|---|
| Claude Code | `.claude/skills/` | `.claude/rules/`, or inside the shared memory file when rules are inline |
| Codex | `.codex/skills/` | inside the memory file |
| Cursor | `.cursor/skills/` | `.cursor/rules/*.mdc` |
| GitHub Copilot | `.github/skills/` | `.github/instructions/*.instructions.md` |
| Antigravity | `.agents/skills/` | `.agents/rules/` |
| Grok Build | `.grok/skills/` | inside the memory file |
| Kimi Code | `.kimi-code/skills/` | inside the memory file — skills are called `/skill:build` |

**One file carries your project's context.** In a Claude-Code-only project that is `CLAUDE.md`; with any other agent it is `AGENTS.md`, and the remaining memory files are generated pointers to it. Edit the one with content — the pointers are overwritten on every update.

**Claude shares inline rules.** When Codex, Grok or Kimi is selected, the kit puts its general and
security rules in `AGENTS.md`. Claude reads them through its `@AGENTS.md` pointer; the kit then
ships no duplicate `general.md` or `security.md` in `.claude/rules/`, which Claude would also load
automatically. Your own additional rules still belong there. On update, old kit copies are retired;
edited copies and copies without a recorded content hash are saved in `.ai-eng-kit-backup/` first.

**One thing is not the same everywhere.** `.claude/settings.json` (Claude Code) and `.grok/config.toml` (Grok Build) *block* reading `.env*` files and force-pushing. Only those two enforce it. With the other agents — Kimi Code included, whose permission rules live in your user config, not in the project — the same rules are instructions your agent follows — real, but not a wall it cannot cross.

### Recommended (optional): live API docs

Memorized API knowledge goes stale. Connecting a live-docs MCP server like **[Context7](https://github.com/upstash/context7)** lets `/architecture` and `/build` pull the *current* API surface of libraries (Supabase, Stripe, Next.js, …) instead of relying on memory — fewer outdated-API bugs. It's entirely optional: every skill works without it and never blocks if it's absent. To enable it, add Context7 as an MCP server in your Claude Code settings.

- **State lives in files, not memory.** Every skill re-reads `features/INDEX.md` and the relevant feature folder at start — nothing is lost after a new session or context compaction.
- **Context is layered.** `CLAUDE.md` + rules (always) → `SKILL.md` (when invoked) → feature spec (on demand) → `docs/production/` (only when referenced).
- **Context is isolated.** Heavy work runs in forked sub-agents with their own context window, so noise from one task doesn't pollute another.
- **Always read, never guess.** A global rule enforces reading a file before modifying it and verifying paths/APIs by reading — preventing hallucinated code references.

---

## Scripts

```bash
npm run dev          # Development server (localhost:3000)
npm run build        # Production build
npm run start        # Production server
npm run lint         # ESLint
npm run typecheck    # Generate Next.js types, then check TypeScript
npm run check        # Lint, typecheck, architecture, unit/integration tests, build
npm run test:structure # Repeatable counter-probes of the architecture config
npm test             # Vitest: unit + integration tests
npm run test:e2e     # Playwright: E2E tests (added by /e2e-tests)
npm run test:all     # Both test suites
```

> Playwright browsers are **not** installed during setup. The first `/e2e-tests` run installs the browser binary (~300 MB) once — keeping everyday setup fast.

`check` is the closing gate for `/build`; during changes run the affected test files. Full test
suites still run only by the main agent per build level and at the end, and once by QA's owner.
The aggregate replaces the closing individual runs, including covered runtimes; `/init checks`
records its coverage. QA keeps its narrow test command and diff-scoped re-verification.
Older scaffolds can adopt the scripts through `/verify-setup`; `update` preserves app tooling.
Existing projects retain their own checks and module convention. The Next.js default structure
and import rules are described in `docs/stacks/framework-nextjs.md`.

---

## Production Guides

Standalone guides in `docs/production/`, surfaced by `/deploy` when relevant:

| Guide | Setup | What it does |
|-------|-------|--------------|
| [Error Tracking](docs/production/error-tracking.md) | 5 min | Sentry integration for automatic error capture |
| [Security Headers](docs/production/security-headers.md) | 2 min | XSS, clickjacking, MIME-sniffing protection |
| [Performance](docs/production/performance.md) | 10 min | Lighthouse checks, image optimization, caching |
| [Database Optimization](docs/production/database-optimization.md) | 15 min | Indexing, N+1 prevention, query optimization |
| [Rate Limiting](docs/production/rate-limiting.md) | 10 min | Upstash Redis for API abuse prevention |

---

## Customize It

This is your project — adapt it freely:

1. **Your memory file** (`CLAUDE.md` or `AGENTS.md` — the one with content) — project-specific conventions and commands. Keep the managed block between the markers intact; it's refreshed on kit updates.
2. **docs/PRD.md** — product vision and roadmap
3. **Your agent's rules folder** — coding standards for your team
4. **Your agent's skills folder** — tweak the workflows themselves. Note that `npx create-ai-eng-app update` regenerates the kit's own skills; put your own in separate folders, they are kept.
5. **.claude/settings.json** — permissions (Claude Code)

---

## Author

Created by **Alex Sprogis** — AI Product Engineer & Content Creator.

- [YouTube](https://www.youtube.com/@alex.sprogis)
- [Website](https://alexsprogis.de)

## License

MIT License — free to use for your projects.
