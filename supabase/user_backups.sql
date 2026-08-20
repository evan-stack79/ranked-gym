-- Ranked Gym — cloud backup (ajoute à schema.sql / SQL Editor)

create table if not exists public.user_backups (
  user_id uuid primary key references auth.users (id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_backups enable row level security;

drop policy if exists "Backups select own" on public.user_backups;
create policy "Backups select own"
  on public.user_backups for select
  using (auth.uid() = user_id);

drop policy if exists "Backups insert own" on public.user_backups;
create policy "Backups insert own"
  on public.user_backups for insert
  with check (auth.uid() = user_id);

drop policy if exists "Backups update own" on public.user_backups;
create policy "Backups update own"
  on public.user_backups for update
  using (auth.uid() = user_id);

drop policy if exists "Backups delete own" on public.user_backups;
create policy "Backups delete own"
  on public.user_backups for delete
  using (auth.uid() = user_id);
