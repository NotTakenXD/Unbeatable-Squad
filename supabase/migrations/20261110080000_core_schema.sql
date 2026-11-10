-- Roshan Rozgar: core schema, security rules and booking logic.

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
create type public.app_role as enum ('customer', 'worker');
create type public.job_status as enum ('open', 'assigned', 'completed', 'cancelled');
create type public.offer_status as enum ('pending', 'accepted', 'declined', 'withdrawn');
create type public.booking_status as enum ('confirmed', 'on_the_way', 'working', 'done', 'cancelled');

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

-- One row per signed-up user. Phone/email stay in auth.users (private).
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text check (char_length(full_name) <= 120),
  avatar_url text,
  city text not null default 'Islamabad',
  preferred_language text not null default 'en' check (preferred_language in ('en', 'ur')),
  last_role public.app_role,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.services (
  id smallint generated always as identity primary key,
  slug text not null unique,
  name text not null,
  name_ur text,
  icon text not null,
  sort_order int not null default 0
);

-- Present only for users who registered as workers.
create table public.worker_profiles (
  id uuid primary key references public.profiles (id) on delete cascade,
  service_id smallint not null references public.services (id),
  headline text check (char_length(headline) <= 120),
  bio text check (char_length(bio) <= 2000),
  years_experience int check (years_experience between 0 and 80),
  area text,
  skills text[] not null default '{}',
  service_areas text[] not null default '{}',
  hourly_rate int check (hourly_rate >= 0),
  fixed_rate_from int check (fixed_rate_from >= 0),
  is_available boolean not null default true,
  voice_intro_path text,
  rating_avg numeric(2, 1) not null default 0,
  rating_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  label text not null default 'Home',
  city text not null default 'Islamabad',
  area text,
  details text,
  created_at timestamptz not null default now()
);

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  service_id smallint references public.services (id),
  -- Set when the customer tapped "Request This Worker" on a profile.
  requested_worker_id uuid references public.worker_profiles (id) on delete set null,
  title text not null check (char_length(title) between 1 and 160),
  description text check (char_length(description) <= 4000),
  voice_note_path text,
  city text not null default 'Islamabad',
  area text,
  budget int check (budget >= 0),
  preferred_time timestamptz,
  status public.job_status not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- A worker's application / counter-offer on a job.
create table public.job_offers (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete cascade,
  worker_id uuid not null default auth.uid() references public.worker_profiles (id) on delete cascade,
  proposed_price int not null check (proposed_price > 0),
  message text check (char_length(message) <= 1000),
  status public.offer_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (job_id, worker_id)
);

-- Created only by accept_offer(); never inserted directly by the app.
create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  job_id uuid unique references public.jobs (id) on delete set null,
  offer_id uuid unique references public.job_offers (id) on delete set null,
  customer_id uuid not null references public.profiles (id) on delete cascade,
  worker_id uuid not null references public.worker_profiles (id) on delete cascade,
  agreed_price int not null check (agreed_price > 0),
  scheduled_at timestamptz,
  city text,
  area text,
  status public.booking_status not null default 'confirmed',
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.messages (
  id bigint generated always as identity primary key,
  sender_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  job_id uuid references public.jobs (id) on delete set null,
  body text not null check (char_length(body) between 1 and 2000),
  read_at timestamptz,
  created_at timestamptz not null default now(),
  check (sender_id <> recipient_id)
);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings (id) on delete cascade,
  customer_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  worker_id uuid not null references public.worker_profiles (id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text check (char_length(comment) <= 1000),
  created_at timestamptz not null default now()
);

create table public.saved_workers (
  customer_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  worker_id uuid not null references public.worker_profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (customer_id, worker_id)
);

create table public.worker_portfolio (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid not null default auth.uid() references public.worker_profiles (id) on delete cascade,
  image_path text not null,
  caption text check (char_length(caption) <= 200),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Indexes (foreign keys and common filters)
-- ---------------------------------------------------------------------------
create index worker_profiles_service_idx on public.worker_profiles (service_id, is_available);
create index addresses_user_idx on public.addresses (user_id);
create index jobs_customer_idx on public.jobs (customer_id);
create index jobs_open_idx on public.jobs (status, service_id, created_at desc);
create index jobs_requested_worker_idx on public.jobs (requested_worker_id);
create index jobs_service_idx on public.jobs (service_id);
create index job_offers_worker_idx on public.job_offers (worker_id);
create index bookings_customer_idx on public.bookings (customer_id, created_at desc);
create index bookings_worker_idx on public.bookings (worker_id, created_at desc);
create index messages_sender_idx on public.messages (sender_id, created_at desc);
create index messages_recipient_idx on public.messages (recipient_id, created_at desc);
create index messages_job_idx on public.messages (job_id);
create index reviews_worker_idx on public.reviews (worker_id, created_at desc);
create index reviews_customer_idx on public.reviews (customer_id);
create index saved_workers_worker_idx on public.saved_workers (worker_id);
create index worker_portfolio_worker_idx on public.worker_portfolio (worker_id);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger worker_profiles_updated_at before update on public.worker_profiles
  for each row execute function public.set_updated_at();
create trigger jobs_updated_at before update on public.jobs
  for each row execute function public.set_updated_at();
create trigger job_offers_updated_at before update on public.job_offers
  for each row execute function public.set_updated_at();
create trigger bookings_updated_at before update on public.bookings
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Create a profile automatically when someone signs up
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, nullif(new.raw_user_meta_data ->> 'full_name', ''));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Keep worker rating in sync with reviews
-- ---------------------------------------------------------------------------
create or replace function public.refresh_worker_rating()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_worker uuid := coalesce(new.worker_id, old.worker_id);
begin
  update public.worker_profiles w
  set rating_avg = coalesce(
        (select round(avg(r.rating)::numeric, 1) from public.reviews r where r.worker_id = v_worker), 0),
      rating_count = (select count(*) from public.reviews r where r.worker_id = v_worker)
  where w.id = v_worker;
  return null;
end;
$$;

create trigger reviews_refresh_rating
  after insert or update or delete on public.reviews
  for each row execute function public.refresh_worker_rating();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.services enable row level security;
alter table public.worker_profiles enable row level security;
alter table public.addresses enable row level security;
alter table public.jobs enable row level security;
alter table public.job_offers enable row level security;
alter table public.bookings enable row level security;
alter table public.messages enable row level security;
alter table public.reviews enable row level security;
alter table public.saved_workers enable row level security;
alter table public.worker_portfolio enable row level security;

-- profiles: workers are public (they appear in search); signed-in users can see
-- names of the people they deal with. Users edit only their own row.
create policy "Worker profiles are public" on public.profiles
  for select to anon
  using (exists (select 1 from public.worker_profiles w where w.id = profiles.id));
create policy "Signed-in users can view profiles" on public.profiles
  for select to authenticated using (true);
create policy "Users update own profile" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- services: read-only catalogue
create policy "Services are public" on public.services
  for select to anon, authenticated using (true);

-- worker_profiles: public read, owner writes (rating columns are not writable, see grants)
create policy "Worker details are public" on public.worker_profiles
  for select to anon, authenticated using (true);
create policy "Users create own worker profile" on public.worker_profiles
  for insert to authenticated with check ((select auth.uid()) = id);
create policy "Workers update own worker profile" on public.worker_profiles
  for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- addresses: owner only
create policy "Users manage own addresses" on public.addresses
  for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- jobs
create policy "Customers see own jobs" on public.jobs
  for select to authenticated using ((select auth.uid()) = customer_id);
create policy "Workers see open jobs" on public.jobs
  for select to authenticated
  using (
    status = 'open'
    and exists (select 1 from public.worker_profiles w where w.id = (select auth.uid()))
    and (requested_worker_id is null or requested_worker_id = (select auth.uid()))
  );
create policy "Workers see jobs they offered on" on public.jobs
  for select to authenticated
  using (exists (
    select 1 from public.job_offers o
    where o.job_id = jobs.id and o.worker_id = (select auth.uid())
  ));
create policy "Customers post jobs" on public.jobs
  for insert to authenticated
  with check ((select auth.uid()) = customer_id and status = 'open');
create policy "Customers edit or cancel open jobs" on public.jobs
  for update to authenticated
  using ((select auth.uid()) = customer_id and status = 'open')
  with check ((select auth.uid()) = customer_id and status in ('open', 'cancelled'));

-- job_offers
create policy "Workers see own offers" on public.job_offers
  for select to authenticated using ((select auth.uid()) = worker_id);
create policy "Customers see offers on their jobs" on public.job_offers
  for select to authenticated
  using (exists (
    select 1 from public.jobs j
    where j.id = job_offers.job_id and j.customer_id = (select auth.uid())
  ));
create policy "Workers make offers on open jobs" on public.job_offers
  for insert to authenticated
  with check (
    (select auth.uid()) = worker_id
    and status = 'pending'
    and exists (
      select 1 from public.jobs j
      where j.id = job_offers.job_id
        and j.status = 'open'
        and j.customer_id <> (select auth.uid())
        and (j.requested_worker_id is null or j.requested_worker_id = (select auth.uid()))
    )
  );
create policy "Workers change or withdraw pending offers" on public.job_offers
  for update to authenticated
  using ((select auth.uid()) = worker_id and status = 'pending')
  with check ((select auth.uid()) = worker_id and status in ('pending', 'withdrawn'));

-- bookings: both sides can read; all changes go through functions below
create policy "Participants see bookings" on public.bookings
  for select to authenticated
  using ((select auth.uid()) in (customer_id, worker_id));

-- messages
create policy "Participants read messages" on public.messages
  for select to authenticated
  using ((select auth.uid()) in (sender_id, recipient_id));
create policy "Users send messages as themselves" on public.messages
  for insert to authenticated
  with check ((select auth.uid()) = sender_id and read_at is null);
create policy "Recipients mark messages read" on public.messages
  for update to authenticated
  using ((select auth.uid()) = recipient_id) with check ((select auth.uid()) = recipient_id);

-- reviews: public read; only the customer of a finished booking can review it
create policy "Reviews are public" on public.reviews
  for select to anon, authenticated using (true);
create policy "Customers review finished bookings" on public.reviews
  for insert to authenticated
  with check (
    (select auth.uid()) = customer_id
    and exists (
      select 1 from public.bookings b
      where b.id = reviews.booking_id
        and b.customer_id = (select auth.uid())
        and b.worker_id = reviews.worker_id
        and b.status = 'done'
    )
  );

-- saved_workers: owner only
create policy "Customers manage saved workers" on public.saved_workers
  for all to authenticated
  using ((select auth.uid()) = customer_id) with check ((select auth.uid()) = customer_id);

-- worker_portfolio: public read, owner writes
create policy "Portfolio is public" on public.worker_portfolio
  for select to anon, authenticated using (true);
create policy "Workers add portfolio items" on public.worker_portfolio
  for insert to authenticated with check ((select auth.uid()) = worker_id);
create policy "Workers delete portfolio items" on public.worker_portfolio
  for delete to authenticated using ((select auth.uid()) = worker_id);

-- ---------------------------------------------------------------------------
-- Column-level grants: stop users from editing fields they shouldn't
-- (ratings, ownership, booking prices, message contents).
-- ---------------------------------------------------------------------------
revoke insert, update, delete on public.services from anon, authenticated;

revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (full_name, avatar_url, city, preferred_language, last_role)
  on public.profiles to authenticated;

revoke insert, update, delete on public.worker_profiles from anon, authenticated;
grant insert (id, service_id, headline, bio, years_experience, area, skills, service_areas,
              hourly_rate, fixed_rate_from, is_available, voice_intro_path)
  on public.worker_profiles to authenticated;
grant update (service_id, headline, bio, years_experience, area, skills, service_areas,
              hourly_rate, fixed_rate_from, is_available, voice_intro_path)
  on public.worker_profiles to authenticated;

revoke update on public.jobs from anon, authenticated;
grant update (service_id, title, description, voice_note_path, city, area, budget,
              preferred_time, status)
  on public.jobs to authenticated;

revoke update on public.job_offers from anon, authenticated;
grant update (proposed_price, message, status) on public.job_offers to authenticated;

revoke insert, update, delete on public.bookings from anon, authenticated;

revoke update, delete on public.messages from anon, authenticated;
grant update (read_at) on public.messages to authenticated;

revoke update, delete on public.reviews from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Booking logic
-- ---------------------------------------------------------------------------

-- Customer accepts a worker's offer -> booking is created at the offered price.
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

-- Customer declines one offer.
create or replace function public.decline_offer(p_offer_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.job_offers o
  set status = 'declined'
  from public.jobs j
  where o.id = p_offer_id
    and j.id = o.job_id
    and j.customer_id = auth.uid()
    and o.status = 'pending';
  if not found then
    raise exception 'Offer not found or already handled';
  end if;
end;
$$;

-- Worker moves a booking forward (confirmed -> on_the_way -> working -> done).
-- Either side can cancel while it is still only confirmed.
create or replace function public.update_booking_status(
  p_booking_id uuid,
  p_status public.booking_status
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.bookings;
  v_steps text[] := array['confirmed', 'on_the_way', 'working', 'done'];
begin
  select * into v from public.bookings where id = p_booking_id for update;
  if not found then
    raise exception 'Booking not found';
  end if;

  if p_status = 'cancelled' then
    if auth.uid() is distinct from v.customer_id and auth.uid() is distinct from v.worker_id then
      raise exception 'Not allowed';
    end if;
    if v.status <> 'confirmed' then
      raise exception 'Only confirmed bookings can be cancelled';
    end if;
    update public.bookings set status = 'cancelled' where id = p_booking_id;
    update public.jobs set status = 'cancelled' where id = v.job_id;
    return;
  end if;

  if auth.uid() is distinct from v.worker_id then
    raise exception 'Only the worker can update job progress';
  end if;
  if v.status = 'cancelled'
     or array_position(v_steps, p_status::text) <= array_position(v_steps, v.status::text) then
    raise exception 'Invalid status change';
  end if;

  update public.bookings
  set status = p_status,
      completed_at = case when p_status = 'done' then now() else completed_at end
  where id = p_booking_id;

  if p_status = 'done' then
    update public.jobs set status = 'completed' where id = v.job_id;
  end if;
end;
$$;

revoke execute on function public.accept_offer(uuid) from public, anon;
revoke execute on function public.decline_offer(uuid) from public, anon;
revoke execute on function public.update_booking_status(uuid, public.booking_status) from public, anon;
grant execute on function public.accept_offer(uuid) to authenticated;
grant execute on function public.decline_offer(uuid) to authenticated;
grant execute on function public.update_booking_status(uuid, public.booking_status) to authenticated;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.refresh_worker_rating() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Starter data
-- ---------------------------------------------------------------------------
insert into public.services (slug, name, name_ur, icon, sort_order) values
  ('electrician', 'Electrician', 'الیکٹریشن', 'bolt', 1),
  ('plumber', 'Plumber', 'پلمبر', 'drop', 2),
  ('carpenter', 'Carpenter', 'بڑھئی', 'hammer', 3),
  ('ac-tech', 'AC Tech', 'اے سی ٹیکنیشن', 'snow', 4);
