# Lizenzzentrale

Die Lizenzzentrale ist ein Self-Service-Portal für Bildungsträger, die Lizenzkontingente für die E-Learning-Plattform zur IHK-Weiterbildung „Geprüfter Technischer Betriebswirt“ gekauft haben. Ein Verwalter des Trägers sieht dort, wie viele Lizenzen vergeben und frei sind, und weist Teilnehmern selbst eine Lizenz zu oder entzieht sie wieder.

Diese Anleitung deckt PROJ-1 „Konto & Login“ ab: Bildungsträger registrieren, anmelden, abmelden, Datentrennung pro Träger, Startkontingent von 5 Lizenzen. Lizenzverwaltung (PROJ-2) und Einladungs-E-Mail (PROJ-3) kommen später dazu, den Stand jedes Features zeigt [`features/INDEX.md`](features/INDEX.md).

## Supabase und Bot-Prüfung einrichten

Die App läuft nur lokal (`npm run dev`) gegen genau ein gehostetes Supabase-Projekt im kostenlosen Tarif. Docker wird nicht gebraucht, ein Deployment gibt es nicht. Die Bot-Prüfung ist Cloudflare Turnstile mit Cloudflares öffentlichen Testschlüsseln.

### 1. Voraussetzungen

- Node.js (LTS) mit npm
- Supabase CLI: `brew install supabase/tap/supabase`, oder ohne Installation über `npx supabase` (dann jedem `supabase`-Befehl unten `npx` voranstellen)
- ein kostenloses Konto bei [Supabase](https://supabase.com)
- Ein Cloudflare-Konto ist nicht nötig, die Turnstile-Testschlüssel sind öffentlich.

### 2. Supabase-Projekt anlegen

1. Im Supabase-Dashboard ein neues Projekt anlegen, Region **eu-central-1 (Frankfurt)**. Die Region lässt sich später nicht ändern.
2. Das Datenbank-Passwort aufbewahren. `supabase link` fragt in Schritt 5 danach.
3. Die Project Ref notieren: der Teil `<ref>` in der Projekt-URL `https://<ref>.supabase.co`, auch zu finden unter Project Settings → General → „Project ID“.

### 3. Einstellungen im Dashboard

Alle Auth-Einstellungen kommen von Hand ins Dashboard. `supabase/config.toml` gilt nur für eine lokale Supabase-Instanz, die dieses Projekt nicht nutzt. **`supabase config push` nicht ausführen:** Es würde die lokalen Standardwerte aus `config.toml` ins Projekt schreiben.

| Wo im Dashboard | Einstellung | Wert | Warum |
|---|---|---|---|
| Authentication → Sign In / Providers → Email | „Confirm email“ | **aus** | Das Konto ist nach der Registrierung sofort aktiv, und nur so meldet Supabase eine schon registrierte Adresse. |
| Authentication → Sign In / Providers → Email (je nach Dashboard-Stand unter Attack Protection) | „Minimum password length“ | **8**, keine Pflicht zu bestimmten Zeichenarten | zweite Linie hinter der Passwortregel der App |
| Authentication → Attack Protection | „Enable Captcha protection“ | **an**, Anbieter Cloudflare Turnstile, Secret `2x0000000000000000000000000000000AA` | Cloudflares Test-Secret, das **immer scheitert**, mit Absicht (siehe unten) |
| Authentication → Audit Logs | „Write audit logs to the database“ | **aus** | Nach dem Löschen eines Kontos verweist keine Zeile in der Datenbank mehr darauf, und im Audit-Log der Datenbank liegen keine IP-Adressen. |
| Integrations → Data API → Settings | „Automatically expose new tables“ (ältere Dashboards: „Default privileges for new entities“) | optional **aus** | Die Migrationen setzen alle Rechte ausdrücklich und funktionieren mit beiden Werten. Mit „aus“ fällt ein vergessenes Recht schon in den Tests auf. |

**Warum ein CAPTCHA-Secret, das immer scheitert:** Die App prüft das Turnstile-Token selbst und ruft Supabase danach mit dem geheimen Server-Schlüssel auf, den Supabase vom CAPTCHA ausnimmt. Supabase lehnt so jede direkte Registrierung und Anmeldung mit dem öffentlichen Schlüssel ab, und jeder Versuch läuft durch die Bot-Prüfung und die Bremsen der App. Dort deshalb nie ein echtes oder ein immer bestehendes Secret eintragen, auch nicht mit eigenen Turnstile-Schlüsseln: Sonst kämen direkte Anmeldungen an der Login-Sperre der App vorbei.

### 4. Umgebungsvariablen

```bash
cp .env.local.example .env.local
```

In `.env.local` diese fünf Werte setzen:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
SUPABASE_SERVICE_ROLE_KEY=sb_secret_...
NEXT_PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA
TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA
```

- `NEXT_PUBLIC_SUPABASE_URL`: Project Settings → Data API (ältere Dashboards: API) → „Project URL“
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Project Settings → API Keys → „Publishable key“ (`sb_publishable_…`) oder der ältere `anon`-Schlüssel
- `SUPABASE_SERVICE_ROLE_KEY`: Project Settings → API Keys → „Secret key“ (`sb_secret_…`) oder der ältere `service_role`-Schlüssel. **Nur für den Server:** nie mit `NEXT_PUBLIC_` davor, nie einchecken.
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY` und `TURNSTILE_SECRET_KEY`: Cloudflares offizielle Testschlüssel, die immer bestehen.

Nicht verwechseln: In `.env.local` steht das Secret `1x…`, das immer besteht. Im Supabase-Dashboard steht das Secret `2x…`, das immer scheitert.

`.env.local` ist über `.gitignore` vom Repository ausgeschlossen. Nach einer Änderung an der Datei `npm run dev` neu starten.

### 5. Datenbankschema einspielen

```bash
supabase login
supabase link --project-ref <ref>   # fragt nach dem Datenbank-Passwort aus Schritt 2
supabase db push                    # spielt die drei Migrationen der Reihe nach ein
supabase migration list             # Local und Remote zeigen dieselben drei Migrationen
```

Die Migrationen in `supabase/migrations/`:

1. `20261021120000_proj1_training_providers.sql`: Tabellen `training_providers` und `training_provider_members` mit Row Level Security, Leseregeln und ausdrücklich gesetzten Rechten, dazu die Trigger, die bei der Registrierung Träger und Mitgliedschaft anlegen und einen Träger ohne Verwalter löschen
2. `20261021120100_proj1_login_throttle.sql`: Login- und Registrierungsbremse im Schema `private` (drei Tabellen, fünf Funktionen, die nur der Server-Schlüssel aufrufen darf) und ein Trigger, der beim Löschen eines Kontos dessen Login-Einträge entfernt
3. `20261021120200_proj1_cleanup_job.sql`: Erweiterung `pg_cron` mit dem stündlichen Aufräumjob `license-center-cleanup`, der die Einträge der Bremsen nach spätestens 24 Stunden löscht

Ist in der Shell ein `SUPABASE_ACCESS_TOKEN` eines anderen Supabase-Kontos gesetzt, nutzt die CLI dieses statt des Logins. Dann jedem Befehl `env -u SUPABASE_ACCESS_TOKEN` voranstellen, z. B. `env -u SUPABASE_ACCESS_TOKEN supabase db push`.

### 6. Starten und ausprobieren

```bash
npm install
npm run dev
```

http://localhost:3000 öffnen, die App leitet zur Anmeldung weiter.

1. **Registrieren** („Noch kein Konto? Registrieren“): Name des Bildungsträgers, E-Mail-Adresse und zweimal ein Passwort mit mindestens 8 Zeichen. Die Bot-Prüfung besteht mit den Testschlüsseln immer, danach wird „Registrieren“ aktiv. Anschließend ist man angemeldet und landet auf der „Lizenzübersicht“, oben rechts stehen der Name des Trägers und „Abmelden“. Der Träger startet mit 5 Lizenzen: in der Tabellenansicht `training_providers.license_quota`, in der App angezeigt erst mit PROJ-2.
2. **Abmelden:** „Abmelden“ führt zurück zur Anmeldung. „Zurück“ im Browser zeigt keine geschützte Seite mehr.
3. **Anmelden** mit derselben E-Mail-Adresse und demselben Passwort: wieder die „Lizenzübersicht“.

Das sollte dabei passieren:

- Falsches Passwort oder unbekannte Adresse: „E-Mail-Adresse oder Passwort ist falsch.“ Beide Fälle sehen gleich aus und antworten frühestens nach 1 Sekunde.
- Nach 5 Fehlversuchen für dieselbe Adresse ist die Anmeldung 15 Minuten gesperrt. Ab dem nächsten Versuch erscheint „Zu viele Anmeldeversuche. Bitte versuchen Sie es in 15 Minuten erneut.“ Pro IP-Adresse greift die Sperre nach 20 Fehlversuchen.
- Registrieren mit einer schon registrierten Adresse: „Mit dieser E-Mail-Adresse ist bereits ein Konto registriert. Bitte melden Sie sich an.“ mit Link „Zum Login“.
- Ab der sechsten Registrierung innerhalb einer Stunde von derselben IP-Adresse (Versuche mit schon registrierten Adressen zählen mit): „Zu viele Registrierungen. Bitte versuchen Sie es später erneut.“
- http://localhost:3000/licenses ohne Anmeldung, z. B. im privaten Fenster: Weiterleitung zur Anmeldung mit dem Hinweis „Bitte melden Sie sich erneut an.“

### 7. Tests

```bash
npm test          # Unit- und Integrationstests (Vitest)
npm run check     # Lint, Typen, Struktur, Tests und Build in einem Lauf
```

- Die Integrationstests laufen gegen das verbundene gehostete Projekt und lesen dieselben Schlüssel aus `.env.local` wie `npm run dev`. Dafür müssen das Schema eingespielt (Schritt 5) und die Dashboard-Einstellungen gesetzt sein (Schritt 3). Ein Test prüft z. B., dass eine direkte Anmeldung mit dem öffentlichen Schlüssel an Supabases CAPTCHA scheitert.
- Die Tests legen Konten mit Adressen wie `lizenzzentrale-test-…@example.com` oder `…@lizenzzentrale-test.de` an und löschen sie am Ende wieder. Ihre Einträge in den Bremsen entfernt der stündliche Aufräumjob, spätestens nach 24 Stunden.
- Supabase begrenzt Anmeldungen pro IP-Adresse. Wer die Suite viele Male hintereinander startet, kann kurz an diese Grenze stoßen und muss dann ein paar Minuten warten.

---

> Ab hier folgt die unveränderte Beschreibung des AI Engineering Kit (englisch), mit dem dieses Projekt entwickelt wird: Arbeitsablauf, Skills, Projektstruktur. Für die Einrichtung dieses Projekts gilt der Abschnitt oben, auch wo das Kit allgemein andere Wege beschreibt (z. B. Supabase lokal mit Docker).

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
