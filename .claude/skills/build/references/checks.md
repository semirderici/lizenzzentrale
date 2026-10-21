# Final checks — one owner, once per covered runtime

Read this at the end of `/build`, including a confirmed group of QA bug fixes. The kit's test-run
budget is unchanged: **single files during tasks/fixes; full tests by the main agent per completed
level and at the end; full tests once by the QA owner before its lanes.** This reference changes
the closing command, not those moments. E2E remains in its own workflow.

## Resolve the coverage before running

Read `.ai-eng-kit` → `commands`, `layers`, `checkLayers`:

- `commands.check`: an optional aggregate command, run from the project root. Missing/null means
  use the recorded individual commands; it is not a missing required check by itself.
- `checkLayers`: names of additional `layers` included by that aggregate. `[]` means the primary
  runtime only. A non-empty list must contain known layer names, without duplicates. `null`, an
  absent scope on an older aggregate, or an unknown name → `/init checks` first. Do not guess a
  monorepo's coverage from the command name.
- Each layer's `commands.check`, where recorded, covers that layer only and runs from its `root`.
  Cross-runtime aggregates belong at the project root with their `checkLayers` recorded.

Use the primary aggregate once, then each layer it does **not** cover once. Where a runtime has no
aggregate, run its recorded `commands.lint`, `commands.test` and `commands.build`, in that order.
An explicitly absent build/lint step is recorded as `false`, with the reason in the canonical
memory file's **How This Project Runs**, by `/init checks`; a null/missing command is a hand-off,
not not-applicable. A Next.js scaffold requires all three. Read that
runtime's pack for any additional recorded type/structure checks; do not invent Next.js tooling
in a different stack. If it has other required checks, propose a real aggregate to its owner.

## Closing and retrying

1. Run the resolved closing commands, sequentially, recording the command, root, covered runtimes
   and result. Stop at the first failure. An aggregate failure blocks completion; never fall back
   to a narrower green command or weaken the check to finish.
2. If a stage fails, repair the cause using that stage or affected test files for the inner loop.
   Group related repairs. Run the closing check again when that group is complete and the code
   changed; do not run the whole aggregate after each edit or assertion.
3. A passing aggregate is the evidence for **all** the individual stages it actually includes.
   Do not follow it with `commands.test` / `commands.build` again, or re-run a covered layer.
   Report the evidence and hand off to `/qa`.

The QA owner still makes its own single suite run for independent verification. **Never substitute
this full aggregate into `/qa`'s pre-fan-out or each lane**: its diff-scoped build/migration checks,
single-file counter-probes and Deferred stop condition remain as written. The same applies to
sub-agents and red proofs: a `check` script exists, but those callers still use a single test file.

## Changes to the checks

A failed check calls for a code fix. If the check itself is wrong, show the failing evidence and
the exact proposed configuration/script/test change with its reason. Obtain the user's review
before changing the requirement; existing authorization for that exact change is sufficient.
Changes to test discovery, skipped tests, assertions, coverage,
rule severities, `checkLayers`, or what an aggregate invokes are verification changes and appear
in the handoff, even when the user already authorized them. Legitimate regression tests and new
dependencies are ordinary work; these instructions do not require asking about every test edit.
