-- jobs and job_offers policies referenced each other, which makes Postgres
-- raise "infinite recursion detected in policy". Move the cross-table checks
-- into helper functions in a private (not API-exposed) schema.

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create or replace function private.owns_job(p_job_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.jobs j where j.id = p_job_id and j.customer_id = (select auth.uid()));
$$;

create or replace function private.has_offer_on(p_job_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.job_offers o where o.job_id = p_job_id and o.worker_id = (select auth.uid()));
$$;

create or replace function private.is_worker()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.worker_profiles w where w.id = (select auth.uid()));
$$;

revoke all on function private.owns_job(uuid) from public, anon;
revoke all on function private.has_offer_on(uuid) from public, anon;
revoke all on function private.is_worker() from public, anon;
grant execute on function private.owns_job(uuid) to authenticated;
grant execute on function private.has_offer_on(uuid) to authenticated;
grant execute on function private.is_worker() to authenticated;

alter policy "Workers see open jobs" on public.jobs
  using (
    status = 'open'
    and (select private.is_worker())
    and (requested_worker_id is null or requested_worker_id = (select auth.uid()))
  );

alter policy "Workers see jobs they offered on" on public.jobs
  using (private.has_offer_on(id));

alter policy "Customers see offers on their jobs" on public.job_offers
  using (private.owns_job(job_id));
