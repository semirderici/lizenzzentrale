-- PROJ-2 Lizenzverwaltung: the licences of a training provider.
-- design.md → Datenmodell, Prüfung vor dem Anlegen, Zugriffsregeln in der Datenbank.
-- Grants and RLS are set explicitly, as in PROJ-1, so the result does not depend on the project
-- settings "Automatically expose new tables" or automatic RLS.

-- ---------------------------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------------------------

-- Exactly these four columns (AC-12): no name, no "revoked" flag, no updated_at. A licence is
-- never changed, only assigned and deleted. The link to a learning account comes later as an
-- optional user_id, without rebuilding anything (docs/data-model.md).
create table public.licenses (
  id uuid primary key default gen_random_uuid(),
  -- Deleting the training provider deletes its licences (AC-11, PROJ-1 AC-12).
  training_provider_id uuid not null
    references public.training_providers (id) on delete cascade,
  email text not null,
  assigned_at timestamptz not null default now(),
  -- One licence per address and training provider (AC-6). Addresses are stored trimmed and
  -- lower-cased, so this holds regardless of case. The key is also the index for reading per
  -- training provider, for counting in the trigger and for the foreign key.
  constraint licenses_training_provider_id_email_key unique (training_provider_id, email),
  -- Deliberately wider than the app's format rule (z.email()): it accepts every address the app
  -- accepts and still keeps out anything without one @, with blanks or control characters, or
  -- without a dot in the domain. Upper case is rejected, not adjusted.
  constraint licenses_email_check check (
    char_length(email) <= 254
    and email = lower(email)
    and email ~ '^[^@[:space:][:cntrl:]]+@[^@[:space:][:cntrl:]]+\.[^@[:space:][:cntrl:]]+$'
  )
);

-- ---------------------------------------------------------------------------------------------
-- Row Level Security: administrators of the training provider read, assign and revoke
-- ---------------------------------------------------------------------------------------------

alter table public.licenses enable row level security;

-- All three ask for the role admin, not just a membership: a later role without write access
-- does not get it by accident.
create policy "Administrators read the licenses of their training provider"
  on public.licenses
  for select
  to authenticated
  using (
    training_provider_id in (
      select m.training_provider_id
      from public.training_provider_members m
      where m.user_id = (select auth.uid())
        and m.role = 'admin'
    )
  );

create policy "Administrators assign licenses of their training provider"
  on public.licenses
  for insert
  to authenticated
  with check (
    training_provider_id in (
      select m.training_provider_id
      from public.training_provider_members m
      where m.user_id = (select auth.uid())
        and m.role = 'admin'
    )
  );

create policy "Administrators revoke licenses of their training provider"
  on public.licenses
  for delete
  to authenticated
  using (
    training_provider_id in (
      select m.training_provider_id
      from public.training_provider_members m
      where m.user_id = (select auth.uid())
        and m.role = 'admin'
    )
  );

revoke all on table public.licenses from public, anon, authenticated, service_role;
grant select, delete on table public.licenses to authenticated;
-- Only these two columns: the database sets id and assigned_at (AC-10, AC-12). No update at all.
grant insert (training_provider_id, email) on table public.licenses to authenticated;
-- Server and tests only; RLS does not apply to this role.
grant select, insert, update, delete on table public.licenses to service_role;

-- ---------------------------------------------------------------------------------------------
-- Check before every insert: quota and "one licence per address" (AC-6, AC-7, EC-1, EC-2)
-- ---------------------------------------------------------------------------------------------

-- Security invoker: the function sees only what RLS shows the caller, so an insert for a foreign
-- training provider fails before anything of it is counted or compared (AC-10). None of the
-- messages contains the address, so none reaches the database log (AC-11).
create function private.enforce_license_rules()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  quota integer;
  assigned integer;
begin
  -- 1. All inserts of one training provider in turn, until the transaction ends. Every query
  --    below takes a fresh snapshot, so the second of two concurrent requests waits here and
  --    then counts the first one's licence (EC-1).
  perform pg_advisory_xact_lock(hashtextextended('licenses:' || new.training_provider_id::text, 0));

  -- 2. A foreign training provider and a missing one look the same.
  select tp.license_quota into quota
  from public.training_providers tp
  where tp.id = new.training_provider_id;
  if not found then
    raise exception using errcode = '42501', message = 'training_provider_not_accessible';
  end if;

  -- 3. Before the quota: at the last free licence the second request for the same address gets
  --    the message of AC-6, not "exhausted" (EC-2). The unique key stays as the hard rule.
  if exists (
    select 1
    from public.licenses l
    where l.training_provider_id = new.training_provider_id
      and l.email = new.email
  ) then
    raise exception using errcode = '23505', message = 'license_already_assigned';
  end if;

  -- 4. A lowered quota leaves existing licences alone; new ones fail until one is free (AC-9).
  select count(*) into assigned
  from public.licenses l
  where l.training_provider_id = new.training_provider_id;
  if assigned >= quota then
    raise exception using errcode = 'P0001', message = 'license_quota_exhausted';
  end if;

  return new;
end;
$$;

create trigger enforce_license_rules
  before insert on public.licenses
  for each row execute function private.enforce_license_rules();

-- Postgres starts a trigger function without checking this right.
revoke all on function private.enforce_license_rules()
  from public, anon, authenticated, service_role;
