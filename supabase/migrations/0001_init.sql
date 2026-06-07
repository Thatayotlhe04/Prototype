-- 0001_init.sql — Project Prototype (Gaborone) schema
-- Postgres + PostGIS. This is the SQL-migration workflow you already know from Supabase:
--   npx supabase db reset      # applies migrations + seed.sql to local
--   npx supabase db push       # pushes migrations to your linked project
-- New change = new timestamped file in this folder. Real, ordered, reviewable migrations.

create extension if not exists postgis;

-- ---------------------------------------------------------------------------
-- pois: curated places. World-readable, never client-writable.
-- geom is a generated geography point so PostGIS can do real distance queries.
-- ---------------------------------------------------------------------------
create table if not exists public.pois (
  id         bigint generated always as identity primary key,
  name       text not null,
  cat        text not null,
  lng        double precision not null,
  lat        double precision not null,
  q          text default '',
  geom       geography(Point, 4326)
             generated always as (st_setsrid(st_makepoint(lng, lat), 4326)::geography) stored,
  created_at timestamptz not null default now()
);
create index if not exists pois_geom_idx on public.pois using gist (geom);

alter table public.pois enable row level security;

drop policy if exists "pois are public" on public.pois;
create policy "pois are public" on public.pois
  for select using (true);
-- (no insert/update/delete policy -> anon & authenticated cannot write; seed via service role)

-- ---------------------------------------------------------------------------
-- submissions: user-contributed places. The product's data layer.
-- Botswana Data Protection Act (2018): location tied to a person is personal
-- data, so a row may only be created WITH explicit consent. RLS enforces it.
-- Not readable by clients — process server-side before surfacing anything.
-- ---------------------------------------------------------------------------
create table if not exists public.submissions (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(name) < 120),
  lng        double precision not null,
  lat        double precision not null,
  note       text,
  consent    boolean not null,
  created_at timestamptz not null default now()
);

alter table public.submissions enable row level security;

drop policy if exists "submit with consent only" on public.submissions;
create policy "submit with consent only" on public.submissions
  for insert
  with check (consent = true);
-- (no select/update/delete policy for anon -> write-only intake)

-- ---------------------------------------------------------------------------
-- places_within(): everything Firestore can't do natively — a true radius query.
-- Returns curated places within `radius_m` metres of a point, nearest first.
--   select * from places_within(25.9122, -24.6581, 3000);
-- ---------------------------------------------------------------------------
create or replace function public.places_within(
  in_lng double precision,
  in_lat double precision,
  radius_m double precision default 3000
)
returns setof public.pois
language sql
stable
as $$
  select *
  from public.pois
  where st_dwithin(
    geom,
    st_setsrid(st_makepoint(in_lng, in_lat), 4326)::geography,
    radius_m
  )
  order by geom <-> st_setsrid(st_makepoint(in_lng, in_lat), 4326)::geography;
$$;
