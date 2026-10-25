-- PROJ-1 Konto & Login: training providers and their memberships.
-- design.md → Datenmodell, Zugriffsregeln in der Datenbank (Rechte-Regel), Trigger.
-- Grants and RLS are set explicitly, so the result does not depend on the project settings
-- "Automatically expose new tables" or automatic RLS.

-- Schema for code that must not be reachable through the Data API (trigger functions here,
-- the login and registration brakes in the next migration).
create schema if not exists private;
revoke all on schema private from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------------------------

create table public.training_providers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  license_quota integer not null default 5,
  created_at timestamptz not null default now(),
  constraint training_providers_name_check
    check (name = btrim(name) and char_length(name) between 2 and 100),
  constraint training_providers_license_quota_check
    check (license_quota >= 0)
);

create table public.training_provider_members (
  training_provider_id uuid not null
    references public.training_providers (id) on delete cascade,
  user_id uuid not null
    references auth.users (id) on delete cascade,
  role text not null default 'admin',
  created_at timestamptz not null default now(),
  primary key (training_provider_id, user_id),
  -- Today an account belongs to exactly one training provider.
  constraint training_provider_members_user_id_key unique (user_id),
  constraint training_provider_members_role_check check (role in ('admin'))
);

-- ---------------------------------------------------------------------------------------------
-- Row Level Security: administrators read their own rows, nobody writes through the API
-- ---------------------------------------------------------------------------------------------

alter table public.training_providers enable row level security;
alter table public.training_provider_members enable row level security;

create policy "Members read their own membership"
  on public.training_provider_members
  for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "Members read their own training provider"
  on public.training_providers
  for select
  to authenticated
  using (
    id in (
      select m.training_provider_id
      from public.training_provider_members m
      where m.user_id = (select auth.uid())
    )
  );

revoke all on table public.training_providers, public.training_provider_members
  from public, anon, authenticated, service_role;
grant select on table public.training_providers, public.training_provider_members
  to authenticated;
-- Server and tests only; RLS does not apply to this role.
grant select, insert, update, delete on table public.training_providers, public.training_provider_members
  to service_role;

-- ---------------------------------------------------------------------------------------------
-- Registration: training provider and membership in the same transaction as the account
-- ---------------------------------------------------------------------------------------------

-- Takes only the name from the registration data. The quota is always the column default (AC-1).
-- An invalid name violates the column check and aborts the whole registration (EC-3).
create function private.license_center_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_training_provider_id uuid;
begin
  insert into public.training_providers (name)
  values (btrim(coalesce(new.raw_user_meta_data ->> 'training_provider_name', '')))
  returning id into new_training_provider_id;

  insert into public.training_provider_members (training_provider_id, user_id, role)
  values (new_training_provider_id, new.id, 'admin');

  return new;
end;
$$;

create trigger license_center_on_auth_user_created
  after insert on auth.users
  for each row execute function private.license_center_handle_new_user();

-- ---------------------------------------------------------------------------------------------
-- Last administrator gone: delete the training provider (AC-12)
-- ---------------------------------------------------------------------------------------------

-- Security definer because Supabase Auth deletes accounts with its own database role.
-- Also runs when the provider deletes only the training provider and the membership goes by
-- cascade (EC-5); the training provider is then already gone and the delete finds nothing.
create function private.delete_orphaned_training_provider()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.training_providers tp
  where tp.id = old.training_provider_id
    and not exists (
      select 1
      from public.training_provider_members m
      where m.training_provider_id = old.training_provider_id
    );

  return null;
end;
$$;

create trigger delete_orphaned_training_provider
  after delete on public.training_provider_members
  for each row execute function private.delete_orphaned_training_provider();

revoke all on function private.license_center_handle_new_user()
  from public, anon, authenticated, service_role;
revoke all on function private.delete_orphaned_training_provider()
  from public, anon, authenticated, service_role;
