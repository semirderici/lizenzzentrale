-- PROJ-1 Konto & Login: hourly cleanup of the login and registration brakes (AC-13).
-- design.md → Aufräumjob. Deleting at 23 hours, every hour, means no entry ever turns 24.

create extension if not exists pg_cron;

create function private.license_center_cleanup()
returns void
language plpgsql
set search_path = ''
as $$
begin
  delete from private.license_center_login_attempts
  where attempted_at < now() - interval '23 hours';

  delete from private.license_center_registration_attempts
  where attempted_at < now() - interval '23 hours';

  -- Locks without effect: the lock is over (or never was) and counting started long enough ago.
  delete from private.license_center_login_lockouts
  where (locked_until is null or locked_until < now() - interval '15 minutes')
    and count_from < now() - interval '15 minutes';
end;
$$;

-- Callable by its owner only; the job runs as that owner.
revoke all on function private.license_center_cleanup()
  from public, anon, authenticated, service_role;

-- Scheduling under an existing name replaces that job, so this stays a single job.
select cron.schedule(
  'license-center-cleanup',
  '0 * * * *',
  $$select private.license_center_cleanup()$$
);
