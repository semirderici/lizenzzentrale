-- PROJ-3 Einladungs-E-Mail: invitation status per licence and the sending limit.
-- design.md → Datenmodell, Datenbankfunktion license_center_begin_invitation /
-- license_center_finish_invitation, Aufräumjob, Zugriffsregeln in der Datenbank.
-- Grants and RLS are set explicitly, as in PROJ-1 and PROJ-2, so the result does not depend on
-- the project settings "Automatically expose new tables" or automatic RLS.

-- ---------------------------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------------------------

-- The state of the last invitation attempt per licence. No row means "not invited yet" (AC-6).
-- Exactly these four columns (AC-12): no address, no mail content, no message of the e-mail
-- service, no counter. How often a licence was invited is counted by the sends below.
create table public.license_invitations (
  -- One invitation per licence. Revoking the licence deletes it (AC-12, EC-5).
  license_id uuid primary key
    references public.licenses (id) on delete cascade,
  -- Always the licence's training provider: only license_center_begin_invitation writes rows,
  -- and it takes the value from the licence. It is here so the read policy matches licenses.
  training_provider_id uuid not null
    references public.training_providers (id) on delete cascade,
  status text not null,
  -- Start of the last attempt, set by the database. It also identifies the attempt for
  -- license_center_finish_invitation.
  last_attempt_at timestamptz not null,
  constraint license_invitations_status_check check (status in ('sending', 'sent', 'failed'))
);

-- For the cascade from the training provider and for the read policy.
create index license_invitations_training_provider_id_idx
  on public.license_invitations (training_provider_id);

-- One row per running or accepted send, the basis of the sending limits (3 per licence, 30 per
-- training provider in 24 hours). No address, no content, no IP (AC-12). A send the e-mail
-- service did not accept is deleted, never recorded.
create table private.license_center_invitation_sends (
  id bigint generated always as identity primary key,
  training_provider_id uuid not null
    references public.training_providers (id) on delete cascade,
  -- Emptied when the licence is revoked: the send keeps counting for the training provider
  -- (AC-8, EC-6) but points to nothing any more (EC-5).
  license_id uuid
    references public.licenses (id) on delete set null,
  outcome text not null default 'pending',
  started_at timestamptz not null default now(),
  constraint license_center_invitation_sends_outcome_check check (outcome in ('pending', 'sent'))
);

create index license_center_invitation_sends_training_provider_id_started_at_idx
  on private.license_center_invitation_sends (training_provider_id, started_at);
create index license_center_invitation_sends_license_id_idx
  on private.license_center_invitation_sends (license_id);
create index license_center_invitation_sends_started_at_idx
  on private.license_center_invitation_sends (started_at);

-- ---------------------------------------------------------------------------------------------
-- Row Level Security: administrators read the invitations of their training provider, nobody
-- writes through the API (AC-9)
-- ---------------------------------------------------------------------------------------------

alter table public.license_invitations enable row level security;
alter table private.license_center_invitation_sends enable row level security;

-- Built like the read policy of licenses: the role admin, the account ID evaluated once per query.
create policy "Administrators read the invitations of their training provider"
  on public.license_invitations
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

revoke all on table public.license_invitations from public, anon, authenticated, service_role;
grant select on table public.license_invitations to authenticated;
-- Tests only; the app writes through the two functions below. RLS does not apply to this role.
grant select, insert, update, delete on table public.license_invitations to service_role;

revoke all on table private.license_center_invitation_sends
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------------------------
-- Begin an invitation: check, then reserve, before the mail goes out (EC-1, EC-2, AC-7, AC-8)
-- ---------------------------------------------------------------------------------------------

-- Returns one of
--   {"status": "allowed", "send_id": n, "email": "…"}
--   {"status": "license_not_found"}
--   {"status": "already_sending"}
--   {"status": "license_limit", "available_from": t}
--   {"status": "provider_limit", "available_from": t}
-- A rejection changes nothing. The address is read from the stored licence and appears only in
-- the answer to "allowed", never in a row or an error of this function (PROJ-2 QA, O-1).
create function public.license_center_begin_invitation(
  p_training_provider_id uuid,
  p_license_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz;
  v_email text;
  v_invitation public.license_invitations;
  v_count integer;
  v_available_from timestamptz;
  v_send_id bigint;
begin
  if p_training_provider_id is null or p_license_id is null then
    raise exception 'license_center_begin_invitation: training provider and licence are required'
      using errcode = '22004';
  end if;

  -- 1. All begins of one training provider in turn, until the transaction ends. Every query below
  --    takes a fresh snapshot, so the second of two concurrent calls waits here and then sees the
  --    first one's reservation (EC-1, EC-2). The clock is read after the lock: under it, every
  --    attempt gets its own, later point in time, which finish uses to recognise the attempt.
  perform pg_advisory_xact_lock(
    hashtextextended('license_invitations:' || p_training_provider_id::text, 0)
  );
  v_now := clock_timestamp();

  -- 2. The licence of exactly this training provider. A foreign and a revoked licence look the
  --    same (EC-5, AC-9). The key share lock lets a concurrent revoke wait until the reservation
  --    is written, so the reservation never points to a licence that is already gone.
  select l.email into v_email
  from public.licenses l
  where l.id = p_license_id
    and l.training_provider_id = p_training_provider_id
  for key share;
  if not found then
    return jsonb_build_object('status', 'license_not_found');
  end if;

  -- 3. A send younger than 2 minutes is still running (EC-1). An older one counts as failed (EC-3).
  select * into v_invitation
  from public.license_invitations i
  where i.license_id = p_license_id;
  if found
    and v_invitation.status = 'sending'
    and v_invitation.last_attempt_at > v_now - interval '2 minutes'
  then
    return jsonb_build_object('status', 'already_sending');
  end if;

  -- 4. Limit of the licence: 3 accepted sends in 24 hours (AC-7). Free again once all but two
  --    have left the window: the (count − 2)-th oldest plus 24 hours.
  select count(*) into v_count
  from private.license_center_invitation_sends s
  where s.license_id = p_license_id
    and s.outcome = 'sent'
    and s.started_at > v_now - interval '24 hours';
  if v_count >= 3 then
    select s.started_at + interval '24 hours' into v_available_from
    from private.license_center_invitation_sends s
    where s.license_id = p_license_id
      and s.outcome = 'sent'
      and s.started_at > v_now - interval '24 hours'
    order by s.started_at
    offset v_count - 3
    limit 1;
    return jsonb_build_object('status', 'license_limit', 'available_from', v_available_from);
  end if;

  -- 5. Limit of the training provider: 30 in 24 hours over all its licences, revoked ones
  --    included (AC-8, EC-6). Running sends count while they run (EC-2), not after 2 minutes (EC-3).
  select count(*) into v_count
  from private.license_center_invitation_sends s
  where s.training_provider_id = p_training_provider_id
    and (
      (s.outcome = 'sent' and s.started_at > v_now - interval '24 hours')
      or (s.outcome = 'pending' and s.started_at > v_now - interval '2 minutes')
    );
  if v_count >= 30 then
    select s.started_at + interval '24 hours' into v_available_from
    from private.license_center_invitation_sends s
    where s.training_provider_id = p_training_provider_id
      and (
        (s.outcome = 'sent' and s.started_at > v_now - interval '24 hours')
        or (s.outcome = 'pending' and s.started_at > v_now - interval '2 minutes')
      )
    order by s.started_at
    offset v_count - 30
    limit 1;
    return jsonb_build_object('status', 'provider_limit', 'available_from', v_available_from);
  end if;

  -- 6. Reserve: the send counts from now on, the list shows "Wird versendet".
  insert into private.license_center_invitation_sends (training_provider_id, license_id, started_at)
  values (p_training_provider_id, p_license_id, v_now)
  returning id into v_send_id;

  insert into public.license_invitations (license_id, training_provider_id, status, last_attempt_at)
  values (p_license_id, p_training_provider_id, 'sending', v_now)
  on conflict (license_id) do update
    set status = excluded.status, last_attempt_at = excluded.last_attempt_at;

  return jsonb_build_object('status', 'allowed', 'send_id', v_send_id, 'email', v_email);
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Finish an invitation with the answer of the e-mail service
-- ---------------------------------------------------------------------------------------------

-- Accepted: the send counts from now on as sent. Not accepted: the send is deleted and never
-- counts. The invitation changes only while it still shows this very attempt, so the late finish
-- of a hanging attempt never overwrites a newer one (EC-3, EC-4). Without a pending send
-- (already finished, training provider deleted) it does nothing; after a revoke there is no
-- licence left to update (EC-5).
create function public.license_center_finish_invitation(p_send_id bigint, p_accepted boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_training_provider_id uuid;
  v_license_id uuid;
  v_started_at timestamptz;
begin
  if p_send_id is null or p_accepted is null then
    raise exception 'license_center_finish_invitation: send and answer are required'
      using errcode = '22004';
  end if;

  select s.training_provider_id into v_training_provider_id
  from private.license_center_invitation_sends s
  where s.id = p_send_id
    and s.outcome = 'pending';
  if not found then
    return;
  end if;

  -- The same lock as begin: a begin of this training provider sees the finish completely or not
  -- at all.
  perform pg_advisory_xact_lock(
    hashtextextended('license_invitations:' || v_training_provider_id::text, 0)
  );

  if p_accepted then
    update private.license_center_invitation_sends s
    set outcome = 'sent'
    where s.id = p_send_id
      and s.outcome = 'pending'
    returning s.license_id, s.started_at into v_license_id, v_started_at;
  else
    delete from private.license_center_invitation_sends s
    where s.id = p_send_id
      and s.outcome = 'pending'
    returning s.license_id, s.started_at into v_license_id, v_started_at;
  end if;
  if not found or v_license_id is null then
    return;
  end if;

  update public.license_invitations i
  set status = case when p_accepted then 'sent' else 'failed' end
  where i.license_id = v_license_id
    and i.status = 'sending'
    and i.last_attempt_at = v_started_at;
end;
$$;

revoke all on function
  public.license_center_begin_invitation(uuid, uuid),
  public.license_center_finish_invitation(bigint, boolean)
  from public, anon, authenticated;
grant execute on function
  public.license_center_begin_invitation(uuid, uuid),
  public.license_center_finish_invitation(bigint, boolean)
  to service_role;

-- ---------------------------------------------------------------------------------------------
-- Cleanup every 5 minutes: sends older than 24 hours (AC-12)
-- ---------------------------------------------------------------------------------------------

-- A row is gone at most 24 hours and 5 minutes after it was written, and the limits always see
-- full 24 hours. The PROJ-1 job license-center-cleanup stays as it is.
create function private.license_center_invitation_cleanup()
returns void
language plpgsql
set search_path = ''
as $$
begin
  delete from private.license_center_invitation_sends
  where started_at < now() - interval '24 hours';
end;
$$;

-- Callable by its owner only; the job runs as that owner.
revoke all on function private.license_center_invitation_cleanup()
  from public, anon, authenticated, service_role;

-- Scheduling under an existing name replaces that job, so this stays a single job.
select cron.schedule(
  'license-center-invitation-cleanup',
  '*/5 * * * *',
  $$select private.license_center_invitation_cleanup()$$
);
