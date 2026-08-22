-- Masquage identité Mode Furtif dans le feed (pseudo + flag explicite)

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
  is_self boolean,
  is_ghost_mode_enabled boolean
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
    case
      when coalesce(p.is_ghost_mode_enabled, false)
        and not (v_uid is not null and a.user_id = v_uid)
      then 'Athlète Furtif'
      else p.pseudo
    end as pseudo,
    a.activity_type,
    a.action_text,
    a.xp_earned,
    public.smooth_distance_label(
      public.haversine_km(p_viewer_lat, p_viewer_lng, a.origin_lat, a.origin_lng),
      coalesce(p.is_ghost_mode_enabled, false)
    ) as distance_label,
    a.created_at,
    (v_uid is not null and a.user_id = v_uid) as is_self,
    coalesce(p.is_ghost_mode_enabled, false) as is_ghost_mode_enabled
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
