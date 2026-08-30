-- In-progress Screen 1 planning sessions (one row per user), so a
-- session started on one device can be continued on another. Same
-- generic shape as the other synced tables.

create table public.planning_sessions (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  clock jsonb not null default '{}'::jsonb,
  deleted boolean not null default false,
  updated_at timestamptz not null default now()
);

create index planning_sessions_user_updated on public.planning_sessions (user_id, updated_at);

alter table public.planning_sessions enable row level security;

create policy "own planning sessions" on public.planning_sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
