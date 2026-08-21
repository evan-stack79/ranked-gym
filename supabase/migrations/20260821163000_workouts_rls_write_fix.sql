-- Ranked Gym — fix écritures Train (workouts / nutrition / user_backups)
-- Dashboard Supabase → SQL Editor → Run
--
-- Garantit RLS INSERT + UPDATE pour auth.uid() (= propriétaire).
-- Requis pour supabase.from('workouts').upsert(...).

-- Tables (no-op si déjà créées)
create table if not exists public.workouts (
  user_id uuid primary key references auth.users (id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  progress jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.nutrition (
  user_id uuid primary key references auth.users (id) on delete cascade,
  profile jsonb not null default '{}'::jsonb,
  journal jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.user_backups (
  user_id uuid primary key references auth.users (id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.workouts enable row level security;
alter table public.nutrition enable row level security;
alter table public.user_backups enable row level security;

-- Grants (role authenticated via PostgREST)
grant select, insert, update, delete on public.workouts to authenticated;
grant select, insert, update, delete on public.nutrition to authenticated;
grant select, insert, update, delete on public.user_backups to authenticated;

-- ---------- workouts ----------
drop policy if exists "Workouts select own" on public.workouts;
create policy "Workouts select own"
  on public.workouts for select
  using (auth.uid() = user_id);

drop policy if exists "Workouts insert own" on public.workouts;
create policy "Workouts insert own"
  on public.workouts for insert
  with check (auth.uid() = user_id);

drop policy if exists "Workouts update own" on public.workouts;
create policy "Workouts update own"
  on public.workouts for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Workouts delete own" on public.workouts;
create policy "Workouts delete own"
  on public.workouts for delete
  using (auth.uid() = user_id);

-- ---------- nutrition ----------
drop policy if exists "Nutrition select own" on public.nutrition;
create policy "Nutrition select own"
  on public.nutrition for select
  using (auth.uid() = user_id);

drop policy if exists "Nutrition insert own" on public.nutrition;
create policy "Nutrition insert own"
  on public.nutrition for insert
  with check (auth.uid() = user_id);

drop policy if exists "Nutrition update own" on public.nutrition;
create policy "Nutrition update own"
  on public.nutrition for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Nutrition delete own" on public.nutrition;
create policy "Nutrition delete own"
  on public.nutrition for delete
  using (auth.uid() = user_id);

-- ---------- user_backups (miroir / fallback) ----------
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
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Backups delete own" on public.user_backups;
create policy "Backups delete own"
  on public.user_backups for delete
  using (auth.uid() = user_id);

-- Ligne workouts vide pour les comptes déjà créés sans seed
insert into public.workouts (user_id, state, progress)
select u.id, '{}'::jsonb, '{}'::jsonb
from auth.users u
on conflict (user_id) do nothing;

insert into public.nutrition (user_id, profile, journal)
select u.id, '{}'::jsonb, '{}'::jsonb
from auth.users u
on conflict (user_id) do nothing;
