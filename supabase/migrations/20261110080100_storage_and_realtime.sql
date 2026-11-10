-- Roshan Rozgar: file storage buckets and live updates.
-- Files are stored under a folder named after the uploader's user id,
-- e.g. voice-notes/<user-id>/job-123.webm

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('voice-notes', 'voice-notes', false, 10485760,
   array['audio/webm', 'audio/ogg', 'audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/x-m4a', 'audio/aac']),
  ('avatars', 'avatars', true, 5242880,
   array['image/jpeg', 'image/png', 'image/webp']),
  ('portfolio', 'portfolio', true, 5242880,
   array['image/jpeg', 'image/png', 'image/webp']);

-- Upload / replace / delete only inside your own folder (all three buckets).
create policy "Users upload to own folder" on storage.objects
  for insert to authenticated
  with check (
    bucket_id in ('voice-notes', 'avatars', 'portfolio')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
create policy "Users update own files" on storage.objects
  for update to authenticated
  using (
    bucket_id in ('voice-notes', 'avatars', 'portfolio')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
create policy "Users delete own files" on storage.objects
  for delete to authenticated
  using (
    bucket_id in ('voice-notes', 'avatars', 'portfolio')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- Voice notes are private: the uploader can listen, workers can listen to the
-- note attached to a job they're allowed to see, and anyone signed in can hear
-- a worker's voice intro.
create policy "Read allowed voice notes" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'voice-notes'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or exists (select 1 from public.jobs j where j.voice_note_path = objects.name)
      or exists (select 1 from public.worker_profiles w where w.voice_intro_path = objects.name)
    )
  );

-- Live updates for chat, offers, bookings and new jobs.
alter publication supabase_realtime add table
  public.messages, public.job_offers, public.bookings, public.jobs;
