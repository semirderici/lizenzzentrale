# Adopting closing checks in an older scaffold

Applies only to `mode: new` + `stack.framework: nextjs`. An existing project's tooling is its own.
The setup helper is `scripts/setup-checks.cjs` relative to **this skill's folder**. Run it from the
project root. It previews by default, validates every collision before writing, and preserves
custom definitions. It never installs packages, runs the check or edits `.ai-eng-kit`.

1. Inspect `package.json`. If its closing check already covers the project's checks, keep it.
   Do not replace a user's aggregate with the kit's command just to match its spelling.
2. For a missing aggregate, run `node <skill-folder>/scripts/setup-checks.cjs` and show its concrete
   proposal. It reuses lint/test/build and any existing typecheck, adding a typecheck only where
   absent (`next typegen && tsc --noEmit`, which works before the first dev/build run).
3. Offer architecture adoption with `--structure` as a separate choice for an older codebase.
   Preview it first. It adds `dependency-cruiser` 17.x (Node 20.12 / 22 / 24+), a project-owned
   config, the structure command and the repeatable counter-probes. See the Next.js pack's Code
   Structure section. Existing module layout stays in place; assess violations before adopting
   a blocking rule, and review any necessary adjustment with the user.
4. When the user approves the shown plan, add `--apply` with the same options. A conflict is a
   hand-off: show the existing definition and proposed change, obtain its review, and adapt it
   explicitly. Do not remove the existing file/script to make the helper pass.
5. Run the project's dependency install if a dependency was added, then `test:structure` once
   when structure was adopted. Its allowed and forbidden fixtures must behave as documented.
   Hand off to `/init checks` to record the command and layer coverage. An already authorized
   concrete adoption does not require another permission question for the same changes.

Setup does not run the aggregate after each repair. `/build` owns its once-at-the-end invocation.
Run the counter-probes again only when their configuration/checker changes; normal app builds
run `check:structure` on real source, without re-creating fixtures every time.

## Review gates for verification definitions

Claude Code's shipped `Edit` ask rules cover package/scripts, lint/type/test/architecture config,
the checker/probe scripts, Claude rules/skills/settings, the check registry and both root memory filenames. `Edit`
rules cover the built-in edit/write tools; separate `Write(path)` rules are not the current
permission syntax. Entire `package.json` is gated because permission patterns cannot select
only its script fields; legitimate dependency changes can therefore prompt too. A setup or
`/init` request may already authorize the shown changes, but do not bypass an enforced prompt.

These are review gates for Claude's recognized tools, not OS-level protection against arbitrary
subprocesses or other coding agents. Claude also protects its configuration directory in some
permission modes. Other agents retain the kit's instruction to surface verification changes;
do not claim they inherit Claude's ask rules. `update` merges the rules and keeps user permissions,
while its explicitly requested CLI writes restore managed files. Tests remain editable for
ordinary development; review discovery/skips/assertion changes against their behavioral contract.

References: [Claude permissions](https://code.claude.com/docs/en/permissions),
[protected paths](https://code.claude.com/docs/en/permission-modes#protected-paths).
