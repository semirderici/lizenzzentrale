-- PROJ-2 BUG-1: the column rule for a participant's address becomes exactly the app's rule.
-- It replaces licenses_email_check from 20261025120000_proj2_licenses.sql, which was deliberately
-- wider: with their own token an administrator could store, through the data API, an address the
-- dialog rejects, against AC-5 ("the same rules apply to requests that bypass the form").
-- design.md → Technische Entscheidungen.
--
-- The pattern is zod's z.email() (node_modules/zod/v4/core/regexes.js → email), which the app
-- applies to the trimmed, lower-cased address. Addresses are stored in that form, so the rule also
-- asks for lower case, and the pattern allows no blanks: upper case is rejected, not adjusted.
-- src/test/db/licenses.test.ts → "Regel der Spalte" runs the app's schema and this rule on one list
-- of addresses and fails as soon as the two judge one of them differently.
alter table public.licenses
  drop constraint licenses_email_check,
  add constraint licenses_email_check check (
    char_length(email) <= 254
    and email = lower(email)
    and email ~ '^(?:[A-Za-z0-9_''+\-]+\.)*[A-Za-z0-9_''+\-]*[A-Za-z0-9_+-]@(?:[A-Za-z0-9][A-Za-z0-9\-]*\.)+[A-Za-z]{2,}$'
  );
