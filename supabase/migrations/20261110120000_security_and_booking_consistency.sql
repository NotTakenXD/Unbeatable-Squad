-- Security hardening + booking consistency.
--
-- 1. Rate-limit helper used by Edge Functions (service role only).
-- 2. "Engaged" workers: anyone can see which workers are on a job right now.
-- 3. accept_offer refuses to double-book a worker within 3 hours of another job,
--    and serialises concurrent accepts for the same worker.
-- 4. Messages: you can message a worker, or someone you already share a job,
--    offer, booking or conversation with (no cold spam to customers).
-- 5. Profiles: customers' names are visible only to people they deal with.

-- ---------------------------------------------------------------------------
-- 1. Rate limiting
-- ---------------------------------------------------------------------------
create table if not exists private.rate_events (
  key text not null,
  created_at timestamptz not null default now()
);
create index if not exists rate_events_key_time_idx on private.rate_events (key, created_at);

create or replace function public.take_rate_token(p_key text, p_limit int, p_window_seconds int)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  n int;
begin
  delete from private.rate_events where created_at < now() - interval '1 day';
  select count(*) into n
  from private.rate_events
  where key = p_key and created_at > now() - make_interval(secs => p_window_seconds);
  if n >= p_limit then
    return false;
  end if;
  insert into private.rate_events (key) values (p_key);
  return true;
end;
$$;
revoke all on function public.take_rate_token(text, int, int) from public, anon, authenticated;
grant execute on function public.take_rate_token(text, int, int) to service_role;

-- ---------------------------------------------------------------------------
-- 2. Which workers are engaged right now (ids only, no booking details)
-- ---------------------------------------------------------------------------
create or replace function public.engaged_worker_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select distinct b.worker_id
  from public.bookings b
  where b.status in ('on_the_way', 'working')
     or (b.status = 'confirmed'
         and coalesce(b.scheduled_at, b.created_at)
             between now() - interval '3 hours' and now() + interval '3 hours');
$$;
revoke all on function public.engaged_worker_ids() from public;
grant execute on function public.engaged_worker_ids() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. No double booking
-- ---------------------------------------------------------------------------
create or replace function public.accept_offer(p_offer_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_offer public.job_offers;
  v_job public.jobs;
  v_booking_id uuid;
  v_when timestamptz;
begin
  select * into v_offer from public.job_offers where id = p_offer_id for update;
  if not found then
    raise exception 'Offer not found';
  end if;

  select * into v_job from public.jobs where id = v_offer.job_id for update;
  if v_job.customer_id is distinct from auth.uid() then
    raise exception 'Not allowed';
  end if;
  if v_job.status <> 'open' or v_offer.status <> 'pending' then
    raise exception 'This offer is no longer available';
  end if;

  -- Lock the worker so two customers can't book the same slot at once.
  perform 1 from public.worker_profiles where id = v_offer.worker_id for update;

  v_when := coalesce(v_job.preferred_time, now());
  if exists (
    select 1 from public.bookings b
    where b.worker_id = v_offer.worker_id
      and b.status in ('confirmed', 'on_the_way', 'working')
      and abs(extract(epoch from (coalesce(b.scheduled_at, b.created_at) - v_when))) < 3 * 3600
  ) then
    raise exception 'This worker is already booked around that time. Please choose another offer.';
  end if;

  update public.job_offers set status = 'accepted' where id = p_offer_id;
  update public.job_offers set status = 'declined'
    where job_id = v_job.id and id <> p_offer_id and status = 'pending';
  update public.jobs set status = 'assigned' where id = v_job.id;

  insert into public.bookings
    (job_id, offer_id, customer_id, worker_id, agreed_price, scheduled_at, city, area)
  values
    (v_job.id, p_offer_id, v_job.customer_id, v_offer.worker_id, v_offer.proposed_price,
     v_job.preferred_time, v_job.city, v_job.area)
  returning id into v_booking_id;

  return v_booking_id;
end;
$$;
revoke execute on function public.accept_offer(uuid) from public, anon;
grant execute on function public.accept_offer(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 4 + 5. Relationship check used by message and profile policies
-- ---------------------------------------------------------------------------
create or replace function private.deals_with(p_other uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    -- booked together
    exists (select 1 from public.bookings b
            where (b.customer_id = (select auth.uid()) and b.worker_id = p_other)
               or (b.worker_id = (select auth.uid()) and b.customer_id = p_other))
    -- an offer between us, either direction
    or exists (select 1 from public.job_offers o join public.jobs j on j.id = o.job_id
               where (j.customer_id = (select auth.uid()) and o.worker_id = p_other)
                  or (o.worker_id = (select auth.uid()) and j.customer_id = p_other))
    -- they posted an open job that I (a worker) can see
    or exists (select 1 from public.jobs j
               where j.customer_id = p_other and j.status = 'open'
                 and exists (select 1 from public.worker_profiles w where w.id = (select auth.uid()))
                 and (j.requested_worker_id is null or j.requested_worker_id = (select auth.uid())))
    -- they messaged me first
    or exists (select 1 from public.messages m
               where m.sender_id = p_other and m.recipient_id = (select auth.uid()));
$$;
revoke all on function private.deals_with(uuid) from public, anon;
grant execute on function private.deals_with(uuid) to authenticated;

alter policy "Users send messages as themselves" on public.messages
  with check (
    (select auth.uid()) = sender_id
    and read_at is null
    and (
      exists (select 1 from public.worker_profiles w where w.id = recipient_id)
      or private.deals_with(recipient_id)
    )
  );

alter policy "Signed-in users can view profiles" on public.profiles
  using (
    id = (select auth.uid())
    or exists (select 1 from public.worker_profiles w where w.id = profiles.id)
    -- reviewers are shown by name next to their public review
    or exists (select 1 from public.reviews r where r.customer_id = profiles.id)
    or private.deals_with(id)
  );
