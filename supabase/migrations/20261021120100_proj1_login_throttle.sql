-- PROJ-1 Konto & Login: login brake and registration brake.
-- design.md → Login-Bremse im Detail, Registrierungsbremse, Zugriffsregeln in der Datenbank.
-- The tables live in `private` (not reachable through the Data API). The app reaches them only
-- through the five functions below, which only `service_role` may execute.

-- ---------------------------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------------------------

-- One row per login attempt that got as far as the password check. Unknown addresses too.
create table private.license_center_login_attempts (
  id bigint generated always as identity primary key,
  email text not null,
  ip_address inet not null,
  outcome text not null default 'pending',
  attempted_at timestamptz not null default now(),
  constraint license_center_login_attempts_email_check
    check (char_length(email) between 1 and 254),
  constraint license_center_login_attempts_outcome_check
    check (outcome in ('pending', 'success', 'failure', 'error'))
);

-- Current or last lock and the start of counting, per e-mail address and per IP address.
create table private.license_center_login_lockouts (
  scope text not null,
  subject text not null,
  locked_until timestamptz,
  count_from timestamptz not null default '-infinity',
  primary key (scope, subject),
  constraint license_center_login_lockouts_scope_check check (scope in ('account', 'ip'))
);

-- One row per registration that got as far as Supabase. No e-mail address (data minimisation).
create table private.license_center_registration_attempts (
  id bigint generated always as identity primary key,
  ip_address inet not null,
  outcome text not null default 'pending',
  attempted_at timestamptz not null default now(),
  constraint license_center_registration_attempts_outcome_check
    check (outcome in ('pending', 'success', 'duplicate', 'error'))
);

create index license_center_login_attempts_email_attempted_at_idx
  on private.license_center_login_attempts (email, attempted_at);
create index license_center_login_attempts_ip_address_attempted_at_idx
  on private.license_center_login_attempts (ip_address, attempted_at);
create index license_center_login_attempts_attempted_at_idx
  on private.license_center_login_attempts (attempted_at);
create index license_center_login_lockouts_count_from_idx
  on private.license_center_login_lockouts (count_from);
create index license_center_registration_attempts_ip_address_attempted_at_idx
  on private.license_center_registration_attempts (ip_address, attempted_at);
create index license_center_registration_attempts_attempted_at_idx
  on private.license_center_registration_attempts (attempted_at);

alter table private.license_center_login_attempts enable row level security;
alter table private.license_center_login_lockouts enable row level security;
alter table private.license_center_registration_attempts enable row level security;

revoke all on table
  private.license_center_login_attempts,
  private.license_center_login_lockouts,
  private.license_center_registration_attempts
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------------------------
-- Login brake: 5 failures per address or 20 per IP within 15 minutes lock for 15 minutes.
-- Failures and pending checks count, never before count_from. success and error never count.
-- Both functions lock the address first, then the IP, so two requests never block each other.
-- ---------------------------------------------------------------------------------------------

-- Returns {"status": "allowed", "attempt_id": n} or {"status": "locked", "locked_until": t}.
create function public.license_center_begin_login(p_email text, p_ip_address inet)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(btrim(p_email));
  v_ip text := host(p_ip_address);
  v_account private.license_center_login_lockouts;
  v_ip_lockout private.license_center_login_lockouts;
  v_locked_until timestamptz;
  v_account_count integer;
  v_ip_count integer;
  v_attempt_id bigint;
begin
  if p_ip_address is null then
    raise exception 'license_center_begin_login: ip address is required' using errcode = '22004';
  end if;
  if v_email is null or v_email = '' or char_length(v_email) > 254 then
    raise exception 'license_center_begin_login: invalid e-mail address' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('license_center_login:account:' || v_email, 0));
  perform pg_advisory_xact_lock(hashtextextended('license_center_login:ip:' || v_ip, 0));

  select * into v_account
  from private.license_center_login_lockouts
  where scope = 'account' and subject = v_email;
  select * into v_ip_lockout
  from private.license_center_login_lockouts
  where scope = 'ip' and subject = v_ip;

  -- With two active locks the later one counts. greatest() ignores nulls.
  v_locked_until := greatest(
    case when v_account.locked_until > now() then v_account.locked_until end,
    case when v_ip_lockout.locked_until > now() then v_ip_lockout.locked_until end
  );
  if v_locked_until is not null then
    return jsonb_build_object('status', 'locked', 'locked_until', v_locked_until);
  end if;

  select count(*) into v_account_count
  from private.license_center_login_attempts
  where email = v_email
    and outcome in ('pending', 'failure')
    and attempted_at > now() - interval '15 minutes'
    and attempted_at > coalesce(v_account.count_from, '-infinity');
  select count(*) into v_ip_count
  from private.license_center_login_attempts
  where ip_address = p_ip_address
    and outcome in ('pending', 'failure')
    and attempted_at > now() - interval '15 minutes'
    and attempted_at > coalesce(v_ip_lockout.count_from, '-infinity');

  -- The limit is reached without a lock: several checks are running at the same time.
  -- Nothing is stored, and the message names the full 15 minutes.
  if v_account_count >= 5 or v_ip_count >= 20 then
    return jsonb_build_object('status', 'locked', 'locked_until', now() + interval '15 minutes');
  end if;

  insert into private.license_center_login_attempts (email, ip_address)
  values (v_email, p_ip_address)
  returning id into v_attempt_id;

  return jsonb_build_object('status', 'allowed', 'attempt_id', v_attempt_id);
end;
$$;

-- Closes a pending attempt with success, failure or error.
create function public.license_center_finish_login(p_attempt_id bigint, p_outcome text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text;
  v_ip_address inet;
  v_ip text;
  v_count_from timestamptz;
  v_count integer;
begin
  if p_outcome is null or p_outcome not in ('success', 'failure', 'error') then
    raise exception 'license_center_finish_login: invalid outcome' using errcode = '22023';
  end if;

  select email, ip_address into v_email, v_ip_address
  from private.license_center_login_attempts
  where id = p_attempt_id and outcome = 'pending';
  if not found then
    raise exception 'license_center_finish_login: no pending attempt %', p_attempt_id
      using errcode = 'P0002';
  end if;
  v_ip := host(v_ip_address);

  perform pg_advisory_xact_lock(hashtextextended('license_center_login:account:' || v_email, 0));
  perform pg_advisory_xact_lock(hashtextextended('license_center_login:ip:' || v_ip, 0));

  update private.license_center_login_attempts
  set outcome = p_outcome
  where id = p_attempt_id and outcome = 'pending';
  if not found then
    raise exception 'license_center_finish_login: no pending attempt %', p_attempt_id
      using errcode = 'P0002';
  end if;

  if p_outcome = 'success' then
    -- EC-7: counting for this address starts again. The IP count stays.
    insert into private.license_center_login_lockouts (scope, subject, count_from)
    values ('account', v_email, now())
    on conflict (scope, subject) do update
      set count_from = greatest(private.license_center_login_lockouts.count_from, excluded.count_from);
    return;
  end if;

  if p_outcome = 'failure' then
    select count_from into v_count_from
    from private.license_center_login_lockouts
    where scope = 'account' and subject = v_email;
    select count(*) into v_count
    from private.license_center_login_attempts
    where email = v_email
      and outcome in ('pending', 'failure')
      and attempted_at > now() - interval '15 minutes'
      and attempted_at > coalesce(v_count_from, '-infinity');
    if v_count >= 5 then
      insert into private.license_center_login_lockouts (scope, subject, locked_until, count_from)
      values ('account', v_email, now() + interval '15 minutes', now() + interval '15 minutes')
      on conflict (scope, subject) do update
        set locked_until = excluded.locked_until, count_from = excluded.count_from;
    end if;

    select count_from into v_count_from
    from private.license_center_login_lockouts
    where scope = 'ip' and subject = v_ip;
    select count(*) into v_count
    from private.license_center_login_attempts
    where ip_address = v_ip_address
      and outcome in ('pending', 'failure')
      and attempted_at > now() - interval '15 minutes'
      and attempted_at > coalesce(v_count_from, '-infinity');
    if v_count >= 20 then
      insert into private.license_center_login_lockouts (scope, subject, locked_until, count_from)
      values ('ip', v_ip, now() + interval '15 minutes', now() + interval '15 minutes')
      on conflict (scope, subject) do update
        set locked_until = excluded.locked_until, count_from = excluded.count_from;
    end if;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Registration brake: 5 registrations per IP within 60 minutes.
-- pending, success and duplicate count; error does not.
-- ---------------------------------------------------------------------------------------------

-- Returns {"status": "allowed", "attempt_id": n} or {"status": "locked"}.
create function public.license_center_begin_registration(p_ip_address inet)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
  v_attempt_id bigint;
begin
  if p_ip_address is null then
    raise exception 'license_center_begin_registration: ip address is required' using errcode = '22004';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('license_center_registration:ip:' || host(p_ip_address), 0)
  );

  select count(*) into v_count
  from private.license_center_registration_attempts
  where ip_address = p_ip_address
    and outcome in ('pending', 'success', 'duplicate')
    and attempted_at > now() - interval '60 minutes';
  if v_count >= 5 then
    return jsonb_build_object('status', 'locked');
  end if;

  insert into private.license_center_registration_attempts (ip_address)
  values (p_ip_address)
  returning id into v_attempt_id;

  return jsonb_build_object('status', 'allowed', 'attempt_id', v_attempt_id);
end;
$$;

-- Closes a pending registration with success, duplicate or error.
create function public.license_center_finish_registration(p_attempt_id bigint, p_outcome text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_outcome is null or p_outcome not in ('success', 'duplicate', 'error') then
    raise exception 'license_center_finish_registration: invalid outcome' using errcode = '22023';
  end if;

  update private.license_center_registration_attempts
  set outcome = p_outcome
  where id = p_attempt_id and outcome = 'pending';
  if not found then
    raise exception 'license_center_finish_registration: no pending attempt %', p_attempt_id
      using errcode = 'P0002';
  end if;
end;
$$;

-- Is there an account with this normalised address? Only for the unclear error case of a
-- registration (EC-2: the loser of two simultaneous registrations gets a generic 500).
create function public.license_center_email_registered(p_email text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from auth.users u where lower(u.email) = lower(btrim(p_email))
  );
$$;

revoke all on function
  public.license_center_begin_login(text, inet),
  public.license_center_finish_login(bigint, text),
  public.license_center_begin_registration(inet),
  public.license_center_finish_registration(bigint, text),
  public.license_center_email_registered(text)
  from public, anon, authenticated;
grant execute on function
  public.license_center_begin_login(text, inet),
  public.license_center_finish_login(bigint, text),
  public.license_center_begin_registration(inet),
  public.license_center_finish_registration(bigint, text),
  public.license_center_email_registered(text)
  to service_role;

-- ---------------------------------------------------------------------------------------------
-- Account deleted: forget its login attempts and its account lock (AC-12)
-- ---------------------------------------------------------------------------------------------

create function private.license_center_forget_deleted_account()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from private.license_center_login_attempts where email = lower(old.email);
  delete from private.license_center_login_lockouts
  where scope = 'account' and subject = lower(old.email);

  return null;
end;
$$;

create trigger license_center_on_auth_user_deleted
  after delete on auth.users
  for each row execute function private.license_center_forget_deleted_account();

revoke all on function private.license_center_forget_deleted_account()
  from public, anon, authenticated, service_role;
