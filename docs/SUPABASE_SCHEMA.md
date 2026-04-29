# Supabase Schema

Phase 1 uses Supabase as an optional lightweight cloud layer. It is not the durable full trial archive.

Google Sheets remains the long-term full trial archive. CSV export remains supported. The local app should continue to work when Supabase is not configured.

## Phase 1 Tables

### `profiles`

- `id uuid primary key`
- `display_name text`
- `public_profile boolean default false`
- `created_at timestamptz default now()`

Purpose:

- User-facing profile metadata.
- Optional public identity for future leaderboards or shared rooms.

### `session_summaries`

- `id uuid primary key`
- `user_id uuid nullable`
- `local_session_id text`
- `protocol_phenomenon text`
- `protocol_type text`
- `target_type text`
- `response_mode text`
- `deck_policy text`
- `option_count int`
- `trial_count int`
- `hit_rate numeric`
- `z_score numeric`
- `p_value numeric`
- `weighted_score numeric`
- `started_at timestamptz`
- `ended_at timestamptz`
- `visibility text default 'private'`
- `archived_to_google_sheet boolean default false`
- `google_sheet_id text nullable`
- `created_at timestamptz default now()`

Purpose:

- Lightweight cloud index of completed sessions.
- Useful for account dashboards, recent-session sync, private summaries, and later public leaderboard summaries.
- Does not store full trial rows.

### `archive_status`

- `id uuid primary key`
- `session_summary_id uuid references session_summaries(id)`
- `local_session_id text`
- `google_sheet_id text nullable`
- `exported_csv boolean default false`
- `synced_to_sheet_at timestamptz nullable`
- `cloud_status text default 'summary_only'`
- `created_at timestamptz default now()`
- `updated_at timestamptz default now()`

Purpose:

- Tracks whether a session summary has been archived elsewhere.
- Distinguishes cloud summary from durable full archive.

## Non-Goals For Phase 1

- Do not store full trial rows in Supabase.
- Do not make Supabase required for local sessions.
- Do not replace Google Sheets or CSV export.
- Do not make shared sessions depend on Supabase yet.

## Future Candidates

- Short codes for session payload hashes.
- Shared session rooms.
- Public or private leaderboard rows.
- Cross-device recent summaries.
- Account-claimed anonymous/local profile migration.
