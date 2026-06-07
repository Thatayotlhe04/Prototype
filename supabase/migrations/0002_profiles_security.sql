-- 0002_profiles_security.sql
-- User profiles, hardened submissions (auth + consent), and DB-level rate limiting.
--   npx supabase db push   (or db reset locally)

-- ---------------------------------------------------------------------------
-- profiles: one row per auth user. Users can only see/edit their own.
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text check (char_length(display_name) <= 80),
  units        text not null default 'km' check (units in ('km','mi')),
  theme        text not null default 'dark' check (theme in ('dark','light')),
  data_consent boolean not null default false,   -- mirrors the Data Protection Act consent
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "own profile select" on public.profiles;
create policy "own profile select" on public.profiles
  for select to authenticated using (auth.uid() = id);

drop policy if exists "own profile insert" on public.profiles;
create policy "own profile insert" on public.profiles
  for insert to authenticated with check (auth.uid() = id);

drop policy if exists "own profile update" on public.profiles;
create policy "own profile update" on public.profiles
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- auto-create a profile row when a user signs up
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(coalesce(new.email,'user'),'@',1)))
  on conflict (id) do nothing;
  return new;
end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users for each row execute function public.handle_new_user();

-- keep updated_at fresh
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;
drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- submissions: now require an authenticated user + consent, and stamp who.
-- ---------------------------------------------------------------------------
alter table public.submissions
  add column if not exists created_by uuid references auth.users(id) default auth.uid();

drop policy if exists "submit with consent only" on public.submissions;
drop policy if exists "auth submit with consent" on public.submissions;
create policy "auth submit with consent" on public.submissions
  for insert to authenticated
  with check (consent = true and created_by = auth.uid());

-- ---------------------------------------------------------------------------
-- Rate limiting at the database edge: max 20 place submissions / hour / user.
-- (Layer this with Supabase's platform limits and a Cloudflare WAF rate rule
--  on the API hostname for defence in depth — see README.)
-- ---------------------------------------------------------------------------
create or replace function public.check_submission_rate()
returns trigger language plpgsql security definer set search_path = public as $$
declare recent integer;
begin
  select count(*) into recent
  from public.submissions
  where created_by = auth.uid()
    and created_at > now() - interval '1 hour';
  if recent >= 20 then
    raise exception 'rate_limit_exceeded' using hint = 'Max 20 submissions per hour.';
  end if;
  return new;
end; $$;
drop trigger if exists submissions_rate on public.submissions;
create trigger submissions_rate before insert on public.submissions
  for each row execute function public.check_submission_rate();
