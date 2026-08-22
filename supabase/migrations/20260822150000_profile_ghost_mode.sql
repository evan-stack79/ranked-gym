-- Mode Furtif — masque la localisation dans le feed social
alter table public.profiles
  add column if not exists is_ghost_mode_enabled boolean not null default false;
