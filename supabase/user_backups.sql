-- Ranked Gym — migration minimale si schema.sql a déjà été partiellement exécuté
-- Préférable : re-exécuter entièrement supabase/schema.sql (idempotent).

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

alter table public.profiles
  add column if not exists custom_spots jsonb not null default '[]'::jsonb;
alter table public.profiles
  add column if not exists active_checkin jsonb;

alter table public.checkins
  add column if not exists gym_payload jsonb;
