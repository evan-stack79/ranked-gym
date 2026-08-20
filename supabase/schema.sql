-- Ranked Gym — schema Supabase (SQL Editor)
-- Exécute ce script une seule fois dans : Dashboard → SQL Editor → New query

-- ---------------------------------------------------------------------------
-- 1. Profiles
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  pseudo text not null,
  level integer not null default 1 check (level >= 1),
  xp integer not null default 0 check (xp >= 0),
  rank text not null default 'Bronze',
  discipline text not null default 'Musculation',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 2. Check-ins
-- ---------------------------------------------------------------------------
create table if not exists public.checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  salle_nom text not null,
  salle_lat double precision,
  salle_lng double precision,
  created_at timestamptz not null default now()
);

create index if not exists checkins_user_id_created_at_idx
  on public.checkins (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 3. Aliments (nutrition / Open Food Facts cache)
-- ---------------------------------------------------------------------------
create table if not exists public.aliments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  nom text not null,
  calories numeric not null default 0,
  proteines numeric not null default 0,
  glucides numeric not null default 0,
  lipides numeric not null default 0,
  barcode text,
  created_at timestamptz not null default now()
);

create index if not exists aliments_barcode_idx on public.aliments (barcode);
create index if not exists aliments_user_id_idx on public.aliments (user_id);

-- ---------------------------------------------------------------------------
-- 4. Auto-create profile on signup (Niveau 1, Rank Bronze)
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base_pseudo text;
begin
  base_pseudo := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'pseudo'), ''),
    nullif(split_part(new.email, '@', 1), ''),
    'Athlete'
  );

  insert into public.profiles (id, pseudo, level, xp, rank, discipline)
  values (new.id, left(base_pseudo, 24), 1, 0, 'Bronze', 'Musculation')
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- 5. RLS
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.checkins enable row level security;
alter table public.aliments enable row level security;

drop policy if exists "Profiles are viewable by owner" on public.profiles;
create policy "Profiles are viewable by owner"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "Profiles are updatable by owner" on public.profiles;
create policy "Profiles are updatable by owner"
  on public.profiles for update
  using (auth.uid() = id);

drop policy if exists "Profiles are insertable by owner" on public.profiles;
create policy "Profiles are insertable by owner"
  on public.profiles for insert
  with check (auth.uid() = id);

drop policy if exists "Checkins select own" on public.checkins;
create policy "Checkins select own"
  on public.checkins for select
  using (auth.uid() = user_id);

drop policy if exists "Checkins insert own" on public.checkins;
create policy "Checkins insert own"
  on public.checkins for insert
  with check (auth.uid() = user_id);

drop policy if exists "Checkins delete own" on public.checkins;
create policy "Checkins delete own"
  on public.checkins for delete
  using (auth.uid() = user_id);

drop policy if exists "Aliments select own or public" on public.aliments;
create policy "Aliments select own or public"
  on public.aliments for select
  using (user_id is null or auth.uid() = user_id);

drop policy if exists "Aliments insert own" on public.aliments;
create policy "Aliments insert own"
  on public.aliments for insert
  with check (auth.uid() = user_id);

drop policy if exists "Aliments delete own" on public.aliments;
create policy "Aliments delete own"
  on public.aliments for delete
  using (auth.uid() = user_id);
