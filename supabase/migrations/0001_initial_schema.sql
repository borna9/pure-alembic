-- Pure Alembic cloud schema (NFR-1). Each row mirrors one local record:
-- `data` holds the record's fields, `clock` maps field -> last-modified
-- timestamp for field-level merge sync (NFR-3), `deleted` is a tombstone.

create table public.categories (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  clock jsonb not null default '{}'::jsonb,
  deleted boolean not null default false,
  updated_at timestamptz not null default now()
);

create table public.tags (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  clock jsonb not null default '{}'::jsonb,
  deleted boolean not null default false,
  updated_at timestamptz not null default now()
);

create table public.tasks (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  clock jsonb not null default '{}'::jsonb,
  deleted boolean not null default false,
  updated_at timestamptz not null default now()
);

create index tasks_user_updated on public.tasks (user_id, updated_at);
create index tags_user_updated on public.tags (user_id, updated_at);
create index categories_user_updated on public.categories (user_id, updated_at);

-- Row-level security: a single user account owns all data (§2.4);
-- every row is only visible to and writable by its owner.
alter table public.categories enable row level security;
alter table public.tags enable row level security;
alter table public.tasks enable row level security;

create policy "own categories" on public.categories
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own tags" on public.tags
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own tasks" on public.tasks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
