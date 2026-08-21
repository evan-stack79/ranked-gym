-- Passe la limite journalière d’analyses photo repas de 3 → 5

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
