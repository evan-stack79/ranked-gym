-- Ranked Gym — quotas Gemini (analyse photo repas)
-- 5 scans / jour / utilisateur (date Europe/Paris)

create table if not exists public.ai_usage_limits (
  user_id uuid not null references auth.users (id) on delete cascade,
  date_of_scan date not null,
  scan_count integer not null default 0 check (scan_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, date_of_scan)
);

create index if not exists ai_usage_limits_user_date_idx
  on public.ai_usage_limits (user_id, date_of_scan desc);

alter table public.ai_usage_limits enable row level security;

grant select on public.ai_usage_limits to authenticated;
-- Écritures uniquement via service_role (Edge Function) — pas de INSERT/UPDATE pour authenticated

drop policy if exists "AI usage select own" on public.ai_usage_limits;
create policy "AI usage select own"
  on public.ai_usage_limits for select
  using (auth.uid() = user_id);

-- Réserve atomiquement 1 scan (max 3 / jour Paris). Retourne allowed + compteur.
create or replace function public.reserve_ai_meal_scan(p_user_id uuid)
returns table (allowed boolean, scan_count integer, daily_limit integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := (timezone('Europe/Paris', now()))::date;
  v_count integer;
  v_limit constant integer := 5;
begin
  if p_user_id is null then
    return query select false, 0, v_limit;
    return;
  end if;

  insert into public.ai_usage_limits (user_id, date_of_scan, scan_count, updated_at)
  values (p_user_id, v_today, 1, now())
  on conflict (user_id, date_of_scan)
  do update
    set scan_count = public.ai_usage_limits.scan_count + 1,
        updated_at = now()
  where public.ai_usage_limits.scan_count < v_limit
  returning public.ai_usage_limits.scan_count into v_count;

  if v_count is null then
    select l.scan_count into v_count
    from public.ai_usage_limits l
    where l.user_id = p_user_id and l.date_of_scan = v_today;
    return query select false, coalesce(v_count, v_limit), v_limit;
    return;
  end if;

  return query select true, v_count, v_limit;
end;
$$;

-- Libère 1 scan si l’appel Gemini a échoué après réservation
create or replace function public.release_ai_meal_scan(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := (timezone('Europe/Paris', now()))::date;
begin
  update public.ai_usage_limits
  set scan_count = greatest(0, scan_count - 1),
      updated_at = now()
  where user_id = p_user_id
    and date_of_scan = v_today
    and scan_count > 0;
end;
$$;

revoke all on function public.reserve_ai_meal_scan(uuid) from public;
revoke all on function public.release_ai_meal_scan(uuid) from public;
grant execute on function public.reserve_ai_meal_scan(uuid) to service_role;
grant execute on function public.release_ai_meal_scan(uuid) to service_role;
