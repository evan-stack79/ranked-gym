-- Security Mission 2: server-side rate limits on live Supabase RPCs / storage.
-- Keys store SHA-256 only (never raw email/password). Convex flags stay off;
-- this hardens the current auth/data path without changing client rollback.

create extension if not exists pgcrypto;

create table if not exists public.rate_limit_buckets (
  key_hash text primary key,
  policy text not null,
  window_started_at timestamptz not null,
  count integer not null,
  updated_at timestamptz not null default now()
);

alter table public.rate_limit_buckets enable row level security;

revoke all on table public.rate_limit_buckets from public, anon, authenticated;

-- consume_rate_limit hashes p_key_material before storage.
-- Callers should pass user id (or another non-email identifier), never a password.
create or replace function public.consume_rate_limit(
  p_policy text,
  p_key_material text,
  p_limit integer,
  p_window_seconds integer
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_hash text;
  v_now timestamptz := now();
  v_row public.rate_limit_buckets%rowtype;
begin
  if p_limit < 1 or p_window_seconds < 1 then
    raise exception 'RATE_LIMIT_CONFIG_INVALID';
  end if;

  v_hash := encode(digest(convert_to(p_policy || '|v1|' || coalesce(p_key_material, ''), 'UTF8'), 'sha256'), 'hex');

  select * into v_row
  from public.rate_limit_buckets
  where key_hash = v_hash
  for update;

  if not found or (v_now - v_row.window_started_at) >= make_interval(secs => p_window_seconds) then
    insert into public.rate_limit_buckets (key_hash, policy, window_started_at, count, updated_at)
    values (v_hash, p_policy, v_now, 1, v_now)
    on conflict (key_hash) do update
      set policy = excluded.policy,
          window_started_at = excluded.window_started_at,
          count = 1,
          updated_at = excluded.updated_at;
    return;
  end if;

  if v_row.count >= p_limit then
    raise exception 'RATE_LIMITED';
  end if;

  update public.rate_limit_buckets
  set count = v_row.count + 1,
      updated_at = v_now
  where key_hash = v_hash;
end;
$$;

revoke all on function public.consume_rate_limit(text, text, integer, integer) from public, anon, authenticated;

create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  -- 8 deletes / 15 min per hashed user id. Recovers after the window.
  perform public.consume_rate_limit('deleteAccount', uid::text, 8, 15 * 60);

  -- Cascade : profiles / workouts / backups via FK on auth.users
  delete from auth.users where id = uid;
end;
$$;

revoke all on function public.delete_own_account() from public;
grant execute on function public.delete_own_account() to authenticated;

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
set search_path = public, extensions
as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'authentication required';
  end if;

  -- 60 writes / 15 min per hashed user id (feed spam / write amplification).
  perform public.consume_rate_limit('recordActivity', v_uid::text, 60, 15 * 60);

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

create or replace function public.enforce_avatar_upload_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_uid uuid := auth.uid();
begin
  -- Service-role / migration uploads have no end-user uid; skip so rollback import still works.
  if v_uid is null then
    return NEW;
  end if;
  if NEW.bucket_id is distinct from 'avatars' then
    return NEW;
  end if;
  -- 20 avatar object writes / 15 min per hashed user id.
  perform public.consume_rate_limit('avatarCommit', v_uid::text, 20, 15 * 60);
  return NEW;
end;
$$;

drop trigger if exists enforce_avatar_upload_rate_limit on storage.objects;
create trigger enforce_avatar_upload_rate_limit
before insert on storage.objects
for each row
when (NEW.bucket_id = 'avatars')
execute function public.enforce_avatar_upload_rate_limit();
