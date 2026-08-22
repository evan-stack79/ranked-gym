-- Ranked Gym — refonte sécurité : RLS durci, table activities, RPC feed obfusqué
-- Exécuter dans Supabase SQL Editor après les migrations précédentes.

-- ---------------------------------------------------------------------------
-- 1. Table activities (coords internes — jamais exposées aux autres users)
-- ---------------------------------------------------------------------------
create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  activity_type text not null check (
    activity_type in ('pr', 'workout', 'checkin', 'rank_up', 'streak')
  ),
  action_text text not null check (char_length(action_text) between 1 and 280),
  xp_earned integer not null default 0 check (xp_earned >= 0 and xp_earned <= 10000),
  origin_lat double precision,
  origin_lng double precision,
  created_at timestamptz not null default now(),
  constraint activities_origin_lat_range check (
    origin_lat is null or (origin_lat >= -90 and origin_lat <= 90)
  ),
  constraint activities_origin_lng_range check (
    origin_lng is null or (origin_lng >= -180 and origin_lng <= 180)
  )
);

create index if not exists activities_created_at_idx
  on public.activities (created_at desc);

create index if not exists activities_user_id_created_at_idx
  on public.activities (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 2. Fonctions utilitaires (distance côté serveur uniquement)
-- ---------------------------------------------------------------------------
create or replace function public.haversine_km(
  lat1 double precision,
  lon1 double precision,
  lat2 double precision,
  lon2 double precision
)
returns double precision
language sql
immutable
parallel safe
as $$
  select case
    when lat1 is null or lon1 is null or lat2 is null or lon2 is null then null
    else (
      6371.0 * acos(
        least(
          1.0,
          greatest(
            -1.0,
            cos(radians(lat1)) * cos(radians(lat2))
              * cos(radians(lon2) - radians(lon1))
              + sin(radians(lat1)) * sin(radians(lat2))
          )
        )
      )
    )
  end;
$$;

create or replace function public.smooth_distance_label(
  distance_km double precision,
  is_ghost boolean
)
returns text
language sql
immutable
as $$
  select case
    when is_ghost then null
    when distance_km is null then null
    when distance_km <= 3.0 then 'Dans ta zone'
    when distance_km <= 12.0 then 'Près de toi'
    else null
  end;
$$;

-- ---------------------------------------------------------------------------
-- 3. RPC feed social — aucune coordonnée brute en sortie
-- ---------------------------------------------------------------------------
create or replace function public.get_social_activity_feed(
  p_viewer_lat double precision default null,
  p_viewer_lng double precision default null,
  p_radius_km double precision default 25,
  p_limit integer default 20
)
returns table (
  id uuid,
  user_id uuid,
  pseudo text,
  activity_type text,
  action_text text,
  xp_earned integer,
  distance_label text,
  created_at timestamptz,
  is_self boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_radius double precision := least(greatest(coalesce(p_radius_km, 25), 1), 100);
begin
  return query
  select
    a.id,
    a.user_id,
    p.pseudo,
    a.activity_type,
    a.action_text,
    a.xp_earned,
    public.smooth_distance_label(
      public.haversine_km(p_viewer_lat, p_viewer_lng, a.origin_lat, a.origin_lng),
      coalesce(p.is_ghost_mode_enabled, false)
    ) as distance_label,
    a.created_at,
    (v_uid is not null and a.user_id = v_uid) as is_self
  from public.activities a
  inner join public.profiles p on p.id = a.user_id
  where
    coalesce(p.is_ghost_mode_enabled, false)
    or p_viewer_lat is null
    or p_viewer_lng is null
    or a.origin_lat is null
    or a.origin_lng is null
    or public.haversine_km(p_viewer_lat, p_viewer_lng, a.origin_lat, a.origin_lng) <= v_radius
  order by a.created_at desc
  limit v_limit;
end;
$$;

revoke all on function public.get_social_activity_feed(double precision, double precision, double precision, integer) from public;
grant execute on function public.get_social_activity_feed(double precision, double precision, double precision, integer) to authenticated, anon;

-- ---------------------------------------------------------------------------
-- 4. RPC enregistrement activité (coords stockées, jamais relues par autrui)
-- ---------------------------------------------------------------------------
create or replace function public.record_activity(
  p_activity_type text,
  p_action_text text,
  p_xp_earned integer default 0,
  p_origin_lat double precision default null,
  p_origin_lng double precision default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'authentication required';
  end if;

  if p_activity_type not in ('pr', 'workout', 'checkin', 'rank_up', 'streak') then
    raise exception 'invalid activity_type';
  end if;

  if p_origin_lat is not null and (p_origin_lat < -90 or p_origin_lat > 90) then
    raise exception 'invalid latitude';
  end if;

  if p_origin_lng is not null and (p_origin_lng < -180 or p_origin_lng > 180) then
    raise exception 'invalid longitude';
  end if;

  insert into public.activities (
    user_id,
    activity_type,
    action_text,
    xp_earned,
    origin_lat,
    origin_lng
  )
  values (
    v_uid,
    p_activity_type,
    left(trim(p_action_text), 280),
    greatest(0, least(coalesce(p_xp_earned, 0), 10000)),
    p_origin_lat,
    p_origin_lng
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.record_activity(text, text, integer, double precision, double precision) from public;
grant execute on function public.record_activity(text, text, integer, double precision, double precision) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Vue publique profiles — strict minimum (pas d’email, GPS, spots, check-in)
-- ---------------------------------------------------------------------------
create or replace view public.profiles_public
with (security_barrier = true)
as
select
  id,
  pseudo,
  level,
  xp,
  rank,
  discipline,
  avatar_url
from public.profiles;

revoke all on public.profiles_public from public;
grant select on public.profiles_public to authenticated, anon;

-- ---------------------------------------------------------------------------
-- 6. RLS durci — profiles
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;

drop policy if exists "Profiles are viewable by owner" on public.profiles;
drop policy if exists "Profiles select own" on public.profiles;
drop policy if exists "Profiles deny anon" on public.profiles;

create policy "Profiles select own"
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = id);

create policy "Profiles deny anon"
  on public.profiles
  for all
  to anon
  using (false)
  with check (false);

drop policy if exists "Profiles are updatable by owner" on public.profiles;
drop policy if exists "Profiles update own" on public.profiles;

create policy "Profiles update own"
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "Profiles are insertable by owner" on public.profiles;
drop policy if exists "Profiles insert own" on public.profiles;

create policy "Profiles insert own"
  on public.profiles
  for insert
  to authenticated
  with check (auth.uid() = id);

revoke all on public.profiles from anon, public;
grant select, insert, update on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- 7. RLS durci — activities (lecture cross-user uniquement via RPC)
-- ---------------------------------------------------------------------------
alter table public.activities enable row level security;

drop policy if exists "Activities select own" on public.activities;
drop policy if exists "Activities insert own" on public.activities;
drop policy if exists "Activities deny anon" on public.activities;

create policy "Activities select own"
  on public.activities
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Activities insert own"
  on public.activities
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Activities deny anon"
  on public.activities
  for all
  to anon
  using (false)
  with check (false);

revoke all on public.activities from anon, public;
grant select, insert on public.activities to authenticated;

-- ---------------------------------------------------------------------------
-- 8. RLS durci — checkins (coords jamais partagées entre utilisateurs)
-- ---------------------------------------------------------------------------
alter table public.checkins enable row level security;

drop policy if exists "Checkins select own" on public.checkins;
drop policy if exists "Checkins insert own" on public.checkins;
drop policy if exists "Checkins delete own" on public.checkins;
drop policy if exists "Checkins deny anon" on public.checkins;

create policy "Checkins select own"
  on public.checkins
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Checkins insert own"
  on public.checkins
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Checkins delete own"
  on public.checkins
  for delete
  to authenticated
  using (auth.uid() = user_id);

create policy "Checkins deny anon"
  on public.checkins
  for all
  to anon
  using (false)
  with check (false);

revoke all on public.checkins from anon, public;
grant select, insert, delete on public.checkins to authenticated;
