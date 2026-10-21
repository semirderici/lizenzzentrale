# Changelog

What changed in the AI Engineering Kit (`create-ai-eng-app`), newest first. In your project this
file lives at `docs/kit/CHANGELOG.md` and is replaced at every `update` — it is the kit's history,
not your project's. `npx create-ai-eng-app update` also prints the entries since your version.

## [Unreleased]

## [0.7.6] — 2026-10-15

### Added
- **Closing checks and a small architecture baseline — with the existing test-run budget preserved.**
  New Next.js scaffolds receive `npm run check` (lint, typecheck, structure, unit/integration tests,
  build), project-owned dependency-cruiser rules and repeatable counter-probes. It replaces build's
  final individual runs; targeted tests, per-level suites and QA's single owner run stay in place.
  `commands.check` / `checkLayers` record aggregate coverage so included runtimes are not checked
  twice. `/init checks` confirms scope; `/verify-setup` previews adoption in older scaffolds,
  preserving existing definitions. Update delivers the helper without changing app tooling.
- **Feature-local code and a design footprint.** The Next.js pack guides responsibilities and
  allowed imports; `/architecture` records module paths/interfaces and the feature's inventory,
  `/tasks` uses them. Existing projects keep their conventions; names are recommended, not a
  universal suffix catalog. Runtime cycles and import boundaries are automatically checked;
  Next.js preserves Server Component data access and supported client-to-Action imports.
- **Claude review gates for check and workflow definitions.** Package/lint/type/test/architecture
  config, checker scripts, Claude rules/skills/settings, memory and registry files use `Edit` ask
  rules. Normal tests remain editable; changes weakening verification are explicitly reported.
  These gates do not imply OS-level isolation or enforcement by other coding agents.
- **Migrations applied by hand are brought under the Supabase CLI — offered by `/verify-setup` and `/init`.**
  Starter Kit projects pasted their `.sql` files into the SQL Editor, so no ledger knew they ran, and
  the first `db push` would run them again; their `YYYYMMDD_name.sql` names also share versions the CLI
  cannot tell apart. The new section in `docs/stacks/backend-supabase.md` checks the signs from the files
  alone and walks through it once: `supabase init`, unique versions (renamed with `git mv`, contents
  unchanged), `login` + `link` by the user, `migration repair --status applied` per file the user
  confirmed, `migration list` and `db push --dry-run` as the evidence. `/starter-kit-migration` names it.

### Fixed
- **Claude no longer receives duplicate kit rules when sharing inline rules with Codex, Grok or Kimi.**
  `AGENTS.md` stays the single maintained project file and supplies the rule bodies through
  Claude's memory pointer. The generator omits native Claude kit copies and redirects its skill
  and QA rule references to `AGENTS.md`; native-rule selections keep their existing layout.
  Update retires only manifest-owned copies, backing up edited entries or entries without content
  hashes before removal. User rules remain. `/verify-setup` accepts both layouts, and documentation
  now correctly describes Claude's automatic native-rule loading.
- **`update` and `add` name a deny rule of yours that cancels a permission the kit grants.** A broad
  `Read(**/.env*)` / `Edit(**/.env*)` from the Starter Kit also matches `.env.local.example`, and deny
  always wins — the agent could neither read nor maintain the example env file the rules tell it to keep.
  The line is quoted with what it blocks and left in place; `/verify-setup` check 3b reports the same.
- **`.env.local.example` says the Supabase CLI needs nothing in it** — `login` and `link` keep the token
  and the database password in the system's credential store; the password never goes into an env file.

## [0.7.5] — 2026-10-01

### Added
- **A quality stance — prototype, standard or strict — asked by `/init`, changeable later with `/init`.**
  `prototype` is for a local thing to try out and show: `/qa` checks only secrets and, where there is a
  real login, its credential gates (the rest is listed as not verified); `/write-spec` proposes demo users
  instead of a login and skips `/dsgvo`; `/deploy` refuses until the stance is raised. What `/build`
  builds is the same in every stance. `strict` makes Medium bugs block too. Projects without the field
  behave as `standard`; `update` adds it as `null`.

### Changed
- **`/qa` no longer loops on Medium and Low bugs** — only Critical and High send a feature back to `/build`.
  The handoff used to send every bug back, so each fresh verifier found a few more cosmetic things
  and the build → QA cycle did not end (community reports: nine rounds, 36 bugs, almost all Low).
  Medium and Low are now decided once with the user: fix now (`Open`) or later (`Deferred`), proposed
  as Medium now, Low later. A new Medium or Low found in a re-verification is `Deferred` automatically.
- **Deferred bugs are fixed in one batch with `/build PROJ-X deferred`** — they stay in `qa-report.md`,
  do not block Approved or `/deploy` (which names them), and `/cleanup` never condenses them.
- **Every bug names its class and a sweep command, and `/build` fixes the class** — all instances the
  sweep finds, not the one reported line; the re-verification re-runs the sweep. `/build` has a
  section for fixing bugs from `qa-report.md` now, and never edits the report itself.
- **QA reports written before this version work as they are** — a bug without a status counts as open;
  `/build` works out its class and search itself, and the next `/qa` rewrites the report in the new format.

## [0.7.4] — 2026-09-24

### Fixed
- **`/reverse-spec` was invisible to the agent** — its frontmatter description held an unquoted `: `,
  which YAML reads as structure, so the block did not parse and the skill never appeared in the
  list (community report). Quoted now; the emitter refuses such a value from here on.
- **`/build`'s level commits no longer stop for a permission prompt** — `git add` joins the scaffold's
  allow list next to `git commit` (`update` merges it into existing projects); `git push` still asks.
  And the "safe place to stop" line is a note the build talks past, never a question it waits on.

## [0.7.3] — 2026-09-18

### Added
- **`/refine` folds several specs of one feature into a single current one** (Path 5, Consolidate).
  For projects where every change got its own spec: it proposes the group, settles contradictions
  against the code (open ones become Open Questions), appends the criteria taken over with new
  AC-IDs and their origin, copies no QA result, moves the absorbed folders to `features/archive/`
  and sets their INDEX rows to the new status **`Merged`**. One feature per run. (Community
  report: close to 200 specs, one feature spread over four of them.)
- **`/refine` names extending a feature as its own path** — a filter, a column, another role are
  new ACs in the existing spec, however large; a new feature ID is only for what could ship and be
  tested alone. `general.md` → Change Routing says the same.
- **`/starter-kit-migration` handles large projects** — above 25 feature files it takes the inventory
  from INDEX and grep instead of reading every spec, converts file by file in sub-agents (three at a
  time, or rounds of 20), checks verbatim mechanically, and ends every round of 20 consistent:
  INDEX repointed, old files moved, one commit, safe to stop. A second call continues with what is
  still flat in `features/`; the report is kept in `.ai-eng-kit-backup/migration-report.md`.
- **`/write-spec` checks whether an existing feature owns the request before it opens a new spec.**
  An extension ("a filter for the ticket list") is recommended to `/refine PROJ-X` instead — one
  spec per feature; the user can still call it separate.
- `/audit` reports features spread over several specs (low, with the `/refine` command) — only where
  the migration recorded them in `.ai-eng-kit-backup/migration-report.md`, until they are `Merged`.
- `/starter-kit-migration` lists features spread over several specs in its inventory and report,
  and points at `/refine` — it still migrates 1:1. `/audit` and `/cleanup` know `Merged` rows,
  `features/archive/` and the `Consolidated from` line.

### Changed
- **An INDEX row changes in its Status cell only** — `general.md` says so now, with where a fix, a
  decision and a test result go instead. Before, "update the tracking files after every change"
  named no place for a bug log outside a `/qa` run, so it ended up in the table row — and INDEX is
  loaded into every session (community report: 1,200 lines). `/cleanup` (no argument) moves what
  rows carry into the feature's files and proposes cutting stacked session logs out of the memory
  file; `/audit` measures both files (memory file above 200 lines, INDEX rows above ~400 characters) and
  points at `/cleanup`.
- **A task has a ceiling now: it must fit one sub-agent's context** — one concern and about five
  files, split beyond that, even past 20 tasks. `/tasks` only had a floor ("no micro-tasks"), so a
  large feature produced tasks whose fork ran into its context limit (community report).
- **`/build` commits every verified level and says it is a safe place to stop.** A usage limit or a
  closed session costs at most the level in flight; calling `/build` again continues at the first
  unticked task and cleans up what the interrupted level left in its worktrees.
- **`/build` runs at most three forks at a time**, a larger level in waves, and hands each fork its
  slice of the design instead of the whole feature folder. Eight cold contexts at once was the
  fastest way into a usage limit. The user can name another width.

## [0.7.2] — 2026-09-17

### Added
- **The kit's release history lands in your project: `docs/kit/CHANGELOG.md`**, written by `create`,
  `add` and `update` and replaced at every update like the other kit-authored guides. Not
  `CHANGELOG.md` at the root — that name belongs to your project's own history and is never touched.
- **`update` prints what is new since your version** — one line per changelog entry between the
  version the project was on and the one it just got, and points at `docs/kit/CHANGELOG.md` for
  the rest.

### Fixed
- `update` could list a new kit file as installed without writing it.

## [0.7.1] — 2026-09-14

### Changed
- **Full test suites run at three moments only** — after each `/build` level, at the end of
  `/build`, once per `/qa` — and everyone else runs single test files. Before, every build
  sub-agent, every red proof and all three `/qa` lanes could start the whole suite (community
  report: seven features, 25 QA reports, an estimated 160 full double-suite runs in 13 days).
  - `/build`: a sub-agent runs only the test files of its own task; the level barrier is where the
    whole suite belongs.
  - `/qa`: the suites run once, by the owner, before the fan-out — like the dev server — and the
    output file is handed to every `qa-engineer` lane next to `probe.baseUrl`. A lane cites that run
    and may start a single file for a counter-probe, never the suites. Step 6 reruns only the files
    it wrote.
- **The red proof is one round per test file**, not one suite run per assertion: break every guard
  the file covers, run that file only, restore. No exemption for "obviously failing" tests — a label
  compared to the value imported from the label module is the tautology the round exists to catch.
- **`/qa` re-verifies a bug fix at the width of the diff**, not the whole feature again. Scope is
  the diff since the commit that wrote the last `qa-report.md`; up to three changed production
  files → one lane with all three scopes; more, or shared code (shell, auth, migrations, data-model
  entities) → the full fan-out. Carried-over results are marked `unchanged since <date>, not
  re-run` and never re-ticked; skipped migration round-trips and production builds say so with the
  diff command. `qa-report.md` gains a `Scope:` line.
- **`/verify-setup`: no E2E specs yet is the expected state**, never a warning. A scaffold from
  before 0.7.0 whose `test:e2e` / `test:all` lack `--pass-with-no-tests` is ⚠️ with the two-line
  fix from `docs/stacks/tests-vitest-playwright.md` — `update` never rewrites `package.json`.
- `tests-vitest-playwright.md`: the single-file forms of both runners, `--changed`, saving a suite
  run for the lanes, and the pre-0.7.0 script fix.

### Added
- **Feature IDs can carry your own prefix** — `--prefix=ABC` on `create`, default `PROJ`. Recorded
  as `.ai-eng-kit` → `featurePrefix`; `add` reads the prefix an existing `features/` folder already carries
  (`APP-1-login.md`, one subfolder level too); `update` fills it into an older stamp the same way and
  says so. The scaffold's INDEX, README and memory files carry it; the kit's skills keep saying
  `PROJ-` and one rule (`general.md` → Feature Tracking) says it stands for the recorded prefix.
  The six hard patterns that actually broke on another prefix — `ls features/ | grep PROJ-`,
  `git log --grep="PROJ-"`, `/verify-setup` 3d, the globs in `/starter-kit-migration` — read the
  prefix now. `/init` asks question 6 in `mode: existing` only when `features/` has entries.
  Status values are **not** configurable — they are the contract between the skills. (Community
  request: a Starter Kit project whose 140 specs carry their own prefix.)

### Fixed
- `/init`'s re-entry in `mode: existing` asks question 5 (a second runtime) once when `layers` is
  `[]` and the map or a second manifest names one — a project updated into the layers feature was
  never asked.
- `update` prints the same second-runtime proposal `add` prints (`a second runtime in backend/ …`)
  whenever `layers` is still `[]` and a manifest one level down states one, and sends the user to
  `/init`. A project installed before 0.6.0 into a Next.js + FastAPI repo got `layers: []` at update
  and nothing ever asked (community report). Still never recorded by the CLI — what the runtime *is*
  is `/init`'s question.

## [0.7.0] — 2026-09-09

### Added
- **Kimi Code** as the seventh agent: skills under `.kimi-code/skills` (called `/skill:build`),
  `qa-engineer` as a real sub-agent under `.kimi-code/agents`, rules inlined into `AGENTS.md`. No
  guardrail file — its permission rules are user-level only.
- **Layers** — a repo with more than one runtime. `.ai-eng-kit` gains `layers[]` (root, language,
  framework, own `commands`, own `probe`, `packs` incl. user-authored ones). `add` proposes a second
  runtime it detects, `/init` question 5 confirms it, `/map` maps every layer,
  `/qa` runs each layer's test command and probes each layer's probe, `/build` reads a layer's packs
  for work under its root, `/audit` counts per layer, `/deploy` hands a layer's release path off.
- **`docs/tech-debt.md`** — a status tracker (`Open / Accepted / Planned / Resolved`) for work with
  no visible behaviour. `/map` appends and marks Resolved, `/refactor` takes its candidate from it,
  `/cleanup` compacts, `/audit` reports dead paths. `concerns.md` stays the snapshot.

### Fixed — the 2026-09-07 whole-project review
- High: Vitest no longer collects the Playwright specs (`exclude: tests/**`); Vitest globals are
  typed (`src/test/vitest-globals.d.ts`) so a globals-style test no longer fails `next build`;
  `/init` can be re-entered in `mode: existing` for the fields the first run left `null`; the
  Next.js rate-limit procedure keys by IP **and** account.
- Medium: the reverse memory migration keeps the rules pointer honest; `update --lang=` changes the
  language; the working-language line goes into the canonical file; `AskUserQuestion` has a
  fallback wording for agents without it; INDEX gains the `## Deployments` record; invoice retention
  8 years (BEG IV), AI Act Art. 50 dates and paragraphs corrected; `framework-nextjs.md` samples use
  `proxy.ts` and never write `.env.local`; the Grok deny list catches up with `settings.json`.
- Scaffold: `@supabase/ssr` clients, `tailwind-merge` 3, `test:all` green on a fresh scaffold
  (`--pass-with-no-tests`), `playwright-report/` and `test-results/` gitignored.

## [0.5.3] — 2026-09-07

### Changed
- **`[user go-live]` tasks.** A setting that needs the production URL or the host (a payment
  webhook endpoint and its signing secret) never blocks `/qa` or Approved: `/qa` verifies the
  test-environment twin and records the production wiring as NOT VERIFIED, `/deploy` makes it and
  verifies it. Before the split an open webhook task was a High bug and Approved was unreachable.

## [0.5.2] — 2026-09-02

### Changed
- **The verifier never carries the builder's context.** `/qa` delegates Steps 1–5 to `qa-engineer`
  sub-agents in three parallel scopes (acceptance, security, regression) that receive only the
  folder, the IDs, the step text that is their scope, `.ai-eng-kit` and how the app is reachable;
  agents without sub-agents get the fresh-session rule.
- The codebase map carries a Stand commit; `/architecture` and `/audit` measure its age.
- `update` migrates the memory file in both directions (CLAUDE.md ↔ AGENTS.md), backs up kit files
  the user edited (content hashes in the stamp), refuses on an unparsable stamp and recreates a
  missing memory file.

### Added
- `desktop` as a platform.

## [0.5.1] — 2026-08-25

### Added
- **EU AI Act** as the third law pack (`law/ai-act.md`), keyed to functionality: rides on `gdpr`,
  wired through `/init`, `/dsgvo` and `/write-spec`.

## [0.5.0] — 2026-08-25

### Added
- **Stack packs** (`docs/stacks/*`): every concrete procedure moved out of the skills into
  capability-cut packs selected at read time from `.ai-eng-kit` → `stack`. `/deploy` went from 84
  stack references to 4.
- **Six agents**: Claude Code, Codex, Cursor, Copilot, Antigravity, Grok Build — one canonical
  `template/kit/`, emitted per agent; `add` for brownfield projects.
- **Law packs**: `/dsgvo` against the GDPR, the Swiss DSG, or both.
- **Brownfield phase 2**: `/map`, `/reverse-spec`, `/refactor`.
- A test counts only after it has been red once (`/build`, `/qa`).

