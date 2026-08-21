-- Daily streak columns on profiles
-- Run via: supabase db push  OR  SQL Editor

alter table public.profiles
  add column if not exists current_streak integer not null default 0 check (current_streak >= 0);

alter table public.profiles
  add column if not exists last_login_date date;

comment on column public.profiles.current_streak is 'Consecutive daily login streak';
comment on column public.profiles.last_login_date is 'Local calendar date of last counted login (YYYY-MM-DD)';
