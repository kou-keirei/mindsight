-- PsiLabs optional cloud summary layer.
-- Google Sheets remains the durable full trial archive; do not store full trial rows here.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key,
  display_name text,
  public_profile boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.session_summaries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid nullable references public.profiles(id) on delete set null,
  local_session_id text,
  protocol_phenomenon text,
  protocol_type text,
  target_type text,
  response_mode text,
  deck_policy text,
  option_count int,
  trial_count int,
  hit_rate numeric,
  z_score numeric,
  p_value numeric,
  weighted_score numeric,
  started_at timestamptz,
  ended_at timestamptz,
  visibility text not null default 'private',
  archived_to_google_sheet boolean not null default false,
  google_sheet_id text nullable,
  created_at timestamptz not null default now(),
  constraint session_summaries_visibility_check check (visibility in ('private', 'unlisted', 'public'))
);

create table if not exists public.archive_status (
  id uuid primary key default gen_random_uuid(),
  session_summary_id uuid references public.session_summaries(id) on delete cascade,
  local_session_id text,
  google_sheet_id text nullable,
  exported_csv boolean not null default false,
  synced_to_sheet_at timestamptz nullable,
  cloud_status text not null default 'summary_only',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint archive_status_cloud_status_check check (cloud_status in ('summary_only', 'pending_archive', 'archived_to_sheet', 'csv_exported'))
);

create index if not exists profiles_public_profile_idx
  on public.profiles (public_profile);

create index if not exists session_summaries_user_id_idx
  on public.session_summaries (user_id);

create index if not exists session_summaries_local_session_id_idx
  on public.session_summaries (local_session_id);

create index if not exists session_summaries_created_at_idx
  on public.session_summaries (created_at desc);

create index if not exists session_summaries_visibility_idx
  on public.session_summaries (visibility);

create index if not exists archive_status_session_summary_id_idx
  on public.archive_status (session_summary_id);

create index if not exists archive_status_local_session_id_idx
  on public.archive_status (local_session_id);

alter table public.profiles enable row level security;
alter table public.session_summaries enable row level security;
alter table public.archive_status enable row level security;

create policy "Public profiles are readable"
  on public.profiles
  for select
  using (public_profile = true);

create policy "Authenticated users can insert their profile"
  on public.profiles
  for insert
  to authenticated
  with check (auth.uid() = id);

create policy "Users can read their profile"
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = id);

create policy "Users can update their profile"
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "Users can read private session summaries"
  on public.session_summaries
  for select
  to authenticated
  using (user_id = auth.uid());

create policy "Public session summaries are readable"
  on public.session_summaries
  for select
  using (visibility = 'public');

create policy "Users can insert their session summaries"
  on public.session_summaries
  for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "Users can update their session summaries"
  on public.session_summaries
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users can read archive status for their summaries"
  on public.archive_status
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.session_summaries
      where session_summaries.id = archive_status.session_summary_id
        and session_summaries.user_id = auth.uid()
    )
  );

create policy "Users can insert archive status for their summaries"
  on public.archive_status
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.session_summaries
      where session_summaries.id = archive_status.session_summary_id
        and session_summaries.user_id = auth.uid()
    )
  );

create policy "Users can update archive status for their summaries"
  on public.archive_status
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.session_summaries
      where session_summaries.id = archive_status.session_summary_id
        and session_summaries.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.session_summaries
      where session_summaries.id = archive_status.session_summary_id
        and session_summaries.user_id = auth.uid()
    )
  );
