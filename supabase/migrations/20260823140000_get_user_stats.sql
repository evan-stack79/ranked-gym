-- Ranked Gym — stats profil FullProfile (radar + courbe 1RM DC)
-- Exécuter dans Supabase SQL Editor après les migrations workouts.

drop function if exists public.get_user_stats(uuid);

create or replace function public.get_user_stats(p_user_id uuid default auth.uid())
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_state jsonb;
  v_result jsonb;
begin
  if p_user_id is null then
    raise exception 'user_id required';
  end if;

  if auth.uid() is distinct from p_user_id then
    raise exception 'forbidden';
  end if;

  select w.state
  into v_state
  from public.workouts w
  where w.user_id = p_user_id;

  if v_state is null then
    v_state := '{}'::jsonb;
  end if;

  with
  notes as (
    select
      coalesce(n.note->>'dateKey', '') as date_key,
      coalesce((n.note->>'createdAt')::bigint, 0) as created_at_ms,
      lower(coalesce(n.note->>'routineId', '')) as routine_id,
      coalesce(n.note->'exercises', '[]'::jsonb) as exercises
    from jsonb_array_elements(coalesce(v_state->'workoutNotes', '[]'::jsonb)) as n(note)
    where coalesce(n.note->>'dateKey', '') ~ '^\d{4}-\d{2}-\d{2}$'
  ),
  sets as (
    select
      n.date_key::date as session_date,
      n.routine_id,
      lower(coalesce(ex.ex->>'name', '')) as exercise_name,
      greatest(coalesce((s.set->>'weightKg')::numeric, 0), 0) as weight_kg,
      greatest(coalesce((s.set->>'reps')::numeric, 0), 0) as reps
    from notes n
    cross join lateral jsonb_array_elements(n.exercises) as ex(ex)
    cross join lateral jsonb_array_elements(coalesce(ex.ex->'sets', '[]'::jsonb)) as s(set)
    where greatest(coalesce((s.set->>'weightKg')::numeric, 0), 0) > 0
      and greatest(coalesce((s.set->>'reps')::numeric, 0), 0) > 0
  ),
  enriched as (
    select
      session_date,
      exercise_name,
      weight_kg,
      reps,
      weight_kg * reps as set_volume,
      weight_kg * (1 + reps / 30.0) as est_1rm,
      case
        when routine_id in ('upper', 'push', 'pull', 'pecs', 'dos', 'epaules', 'bras') then 'upper'
        when routine_id in ('lower', 'legs', 'jambes', 'fessiers') then 'lower'
        when exercise_name ~ '(squat|leg|jambe|cuiss|fessier|mollet|deadlift|soulev|fente|lunge|hip thrust|presse.*cuiss|hack squat|extension.*jambe|flexion.*jambe|mollets|calf)'
          then 'lower'
        when exercise_name ~ '(pec|poitrine|chest|epaule|shoulder|develop|bench|couch|curl|triceps|biceps|tirage|rowing|pull|push|lat|dos|fly|ecart|dip|presse|ohp|overhead|tractions|pompes)'
          then 'upper'
        else 'other'
      end as body_zone,
      case
        when exercise_name ~ '(develop|developer|bench|couch|dc |développ|dev couch)'
          then true
        else false
      end as is_bench
    from sets
  ),
  recent as (
    select *
    from enriched
    where session_date >= (current_date - interval '28 days')
  ),
  aggregates as (
    select
      coalesce(sum(case when body_zone = 'upper' then set_volume else 0 end), 0) as upper_volume,
      coalesce(sum(case when body_zone = 'lower' then set_volume else 0 end), 0) as lower_volume,
      coalesce(sum(set_volume), 0) as total_volume,
      coalesce(max(est_1rm), 0) as max_1rm_recent,
      coalesce(max(est_1rm) filter (where session_date < (current_date - interval '14 days')), 0) as max_1rm_older
    from recent
  ),
  week_series as (
    select
      gs.idx,
      (date_trunc('week', current_date)::date - ((3 - gs.idx) * interval '7 days'))::date as week_start,
      case gs.idx
        when 0 then 'S-3'
        when 1 then 'S-2'
        when 2 then 'S-1'
        else 'Act.'
      end as week_label
    from generate_series(0, 3) as gs(idx)
  ),
  bench_weekly as (
    select
      ws.idx,
      ws.week_label,
      coalesce(max(e.est_1rm), 0)::numeric as value_kg
    from week_series ws
    left join enriched e
      on e.is_bench
     and e.session_date >= ws.week_start
     and e.session_date < (ws.week_start + interval '7 days')
    group by ws.idx, ws.week_label
    order by ws.idx
  ),
  sessions_last_7 as (
    select count(distinct session_date)::integer as cnt
    from enriched
    where session_date >= (current_date - interval '6 days')
  ),
  sessions_this_week as (
    select count(distinct session_date)::integer as cnt
    from enriched
    where session_date >= date_trunc('week', current_date)::date
  ),
  scores as (
    select
      least(100, greatest(0, round(upper_volume / 25000.0 * 100)))::integer as upper_score,
      least(100, greatest(0, round(lower_volume / 25000.0 * 100)))::integer as lower_score,
      least(100, greatest(0, round(total_volume / 50000.0 * 100)))::integer as volume_score,
      case
        when max_1rm_older > 0 then
          least(100, greatest(0, round(50 + ((max_1rm_recent - max_1rm_older) / max_1rm_older) * 100)))::integer
        when max_1rm_recent > 0 then 55
        else 0
      end as force_score,
      least(100, greatest(0, round((select cnt from sessions_last_7) / 4.0 * 100)))::integer as regularite_score
    from aggregates
  )
  select jsonb_build_object(
    'radar', jsonb_build_object(
      'upper', (select upper_score from scores),
      'lower', (select lower_score from scores),
      'force', (select force_score from scores),
      'volume', (select volume_score from scores),
      'regularite', (select regularite_score from scores)
    ),
    'bench_1rm_curve', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'label', bw.week_label,
            'value_kg', round(bw.value_kg::numeric, 1)
          )
          order by bw.idx
        )
        from bench_weekly bw
      ),
      '[]'::jsonb
    ),
    'weekly_sessions', jsonb_build_object(
      'completed', (select cnt from sessions_this_week),
      'target', 4
    )
  )
  into v_result;

  return coalesce(v_result, '{}'::jsonb);
end;
$$;

revoke all on function public.get_user_stats(uuid) from public;
grant execute on function public.get_user_stats(uuid) to authenticated;
