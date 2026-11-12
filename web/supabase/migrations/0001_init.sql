-- Roadmap: tables, roles and row-level security.
-- Run once in the Supabase SQL editor (or with `supabase db push`).
-- Everyone can read. Only signed-in editors (Product and Head of Development) can write.

create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text,
  role text not null default 'viewer'
    check (role in ('product', 'dev', 'exec', 'marketing', 'support', 'cs', 'viewer')),
  created_at timestamptz not null default now()
);

-- every new sign-in gets a profile; an editor promotes people by changing `role`
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (user_id, email) values (new.id, new.email)
  on conflict (user_id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.is_editor() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where user_id = auth.uid() and role in ('product', 'dev'));
$$;

create table if not exists public.projects (
  id integer primary key,
  rank integer not null,
  name text not null,
  stage text not null check (stage in ('intake', 'discovery', 'ready', 'dev', 'uat', 'released', 'review')),
  committed boolean not null default false,
  owner text,
  summary text,
  budget numeric,          -- developer weeks, never dollars
  estimate numeric,        -- developer weeks
  spent numeric,           -- developer weeks spent to date
  max_devs integer,
  progress integer,
  release_id integer,
  deliverables jsonb,      -- { ps|sys|uat|mkt|pra: { status, link } }
  extra jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.dependencies (
  project_id integer not null references public.projects (id) on delete cascade,
  on_project_id integer not null references public.projects (id) on delete cascade,
  on_stage text not null,
  then_kind text not null check (then_kind in ('start', 'finish')),
  lag_days integer not null default 0 check (lag_days >= 0),
  primary key (project_id, on_project_id, on_stage, then_kind)
);

create table if not exists public.stage_history (
  key text primary key,
  project_id integer not null references public.projects (id) on delete cascade,
  seq integer not null,
  date date not null,
  from_stage text,
  to_stage text not null,
  by_name text
);

create table if not exists public.releases (
  id integer primary key,
  name text not null,
  theme text,
  date date not null,
  status text not null check (status in ('planning', 'locked', 'released')),
  extra jsonb not null default '{}'::jsonb
);

create table if not exists public.release_activities (
  release_id integer not null references public.releases (id) on delete cascade,
  id integer not null,
  team text not null,
  name text not null,
  offset_days integer not null,   -- days relative to the release date
  status text not null check (status in ('todo', 'prog', 'done', 'blocked')),
  owner text,
  link text,
  extra jsonb not null default '{}'::jsonb,
  primary key (release_id, id)
);

create table if not exists public.release_updates (
  key text primary key,
  release_id integer not null references public.releases (id) on delete cascade,
  seq integer not null,
  date date not null,
  by_name text,
  msg text not null
);

create table if not exists public.alerts (
  key text primary key,
  seq integer not null,     -- 0 is the newest
  date date not null,
  body jsonb not null       -- { pid?, stage?, rid?, kind?, msg?, roles[], by }
);

create table if not exists public.settings (
  key text primary key,     -- capacity, subs, counters
  value jsonb not null
);

-- row-level security: read for everyone, write for editors
do $$
declare t text;
begin
  foreach t in array array['projects', 'dependencies', 'stage_history', 'releases', 'release_activities', 'release_updates', 'alerts', 'settings'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "%s read" on public.%I', t, t);
    execute format('create policy "%s read" on public.%I for select using (true)', t, t);
    execute format('drop policy if exists "%s write" on public.%I', t, t);
    execute format('create policy "%s write" on public.%I for all using (public.is_editor()) with check (public.is_editor())', t, t);
  end loop;
end $$;

alter table public.profiles enable row level security;
drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles for select using (user_id = auth.uid() or public.is_editor());
drop policy if exists "editors manage roles" on public.profiles;
create policy "editors manage roles" on public.profiles for update using (public.is_editor()) with check (public.is_editor());

-- After you sign in for the first time, make yourself an editor:
--   update public.profiles set role = 'product' where email = 'you@example.com';
