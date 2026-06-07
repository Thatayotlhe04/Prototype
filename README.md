# Project Prototype — Gaborone

An interactive, monochrome map of Gaborone. Real OpenStreetMap geometry, landmark
search, live routing. This repo is the **next step** past the single-file
prototype: a real project you can run, build, ship to the web, and wrap as a
desktop app — now backed by **Supabase (Postgres + PostGIS)** with proper SQL
migrations.

---

## See it in 10 seconds
- **`preview.html`** — the map, raster engine. **Renders anywhere** — phones,
  locked-down preview panes, any browser. Open this one first.
- **`preview-3d.html`** — the full 3D vector build (MapLibre). Open it in a
  **desktop browser** (it needs WebGL workers, which some sandboxed preview panes
  block — that's the black screen you saw, not a bug in the build).

The `src/` app uses the 3D vector engine and runs great in Electron and on a
hosted URL, where nothing sandboxes it.

---

## What's in the box

```
project-prototype/
├─ index.html              # web app shell (served by Vercel, loaded by Electron)
├─ src/
│  ├─ main.ts              # bootstrap: load places, then start the map
│  ├─ style.css            # monochrome glass / pill design system
│  ├─ map/
│  │  ├─ app.ts            # MapLibre init, markers, search, routing, controls
│  │  ├─ style.ts          # custom black-&-white style (dark + light)
│  │  └─ pois.ts           # curated Gaborone landmarks (typed)
│  └─ data/
│     └─ supabase.ts       # load places, consent-gated submit, PostGIS radius query
├─ electron/               # desktop shell (main + preload)
├─ supabase/
│  ├─ migrations/
│  │  └─ 0001_init.sql     # schema: pois, submissions, RLS, places_within()
│  ├─ seed.sql             # curated places
│  └─ config.toml          # local dev config
├─ preview.html            # raster map — renders everywhere
├─ preview-3d.html         # full 3D vector build — open on desktop
├─ vite.config.ts          # web build (-> dist/)
├─ vercel.json             # Vercel deploy config
└─ .env.example            # Supabase keys go here (copy to .env)
```

---

## Firebase vs Supabase — for *this* use case, Supabase

You asked, and the honest answer is Supabase is the better fit here — not a close
call:

- **Geospatial.** This is a map. You'll want "places within 3 km", bounding-box
  queries, nearest-first. Supabase is Postgres + **PostGIS**, which does this
  natively (`ST_DWithin`, `<->` nearest-neighbour) — see `places_within()` in the
  migration. Firestore has **no native geo radius query**; you bolt on geohashing
  (the `geofirestore` library) and it's still clumsy.
- **Migrations.** You already think in migrations, and you were right to expect
  them — that's a Supabase/Postgres thing. **Firestore is schemaless with no
  migrations at all**, which is the mismatch that tripped you up. Here, schema
  changes are ordinary timestamped SQL files in `supabase/migrations/`.
- **Access rules.** Postgres **Row Level Security** expresses your consent rule as
  one policy you can read. It's just SQL.
- **You already know it.** Lower friction, faster shipping.

Firestore wins on realtime-by-default and Google-ecosystem glue, but none of that
outweighs native geo + migrations for a location product. So I swapped the backend
to Supabase. (Want the Firebase variant back? Say the word.)

---

## Supabase setup

```bash
# 1) Create a project at supabase.com -> Project settings -> API
cp .env.example .env        # fill VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY

# 2) Link + push the schema (Supabase CLI via npx, no global install needed)
npx supabase login
npx supabase link --project-ref YOUR-PROJECT-REF
npx supabase db push        # applies migrations/0001_init.sql

# 3) Load curated places
#    Local:  `npx supabase db reset` applies migrations + seed.sql
#    Remote: paste supabase/seed.sql into the SQL editor, or psql the DB URL
```

Until `.env` is filled in, the app runs on the bundled list in `src/map/pois.ts`
— no Supabase needed to develop the UI.

### Schema (in `0001_init.sql`)
- `pois` — curated places. Public read, never client-writable. `geom` is a
  generated PostGIS point so distance queries are free.
- `submissions` — user-contributed places. **RLS allows an insert only when
  `consent = true`**, with no read policy (write-only intake).
- `places_within(lng, lat, radius_m)` — real radius query, nearest first.

### The data plan, made lawful
Your model — collect place/location input, improve the map, monetise later — is
fine, but in Botswana **location tied to a person is personal data under the Data
Protection Act (2018).** So the consent gate is enforced twice: the RLS policy
refuses any row without `consent = true`, and `submitPlace(..., consent)` in
`src/data/supabase.ts` won't attempt a write without it. Wire a clear consent
prompt to that call — far cheaper now than retrofitting once you have users.

---

## Run it

Requires Node 18+.

```bash
npm install
npm run dev:web     # web only -> http://localhost:5173 (fastest loop)
npm run dev         # desktop app (Vite + Electron together)
```

## Build & ship

```bash
npm run build:web   # -> dist/  (Vercel deploys this)
npm run package     # -> release/  desktop installers (mac/win/linux)
npm run typecheck
```

### Electron vs Vercel vs TypeScript — they stack, they don't compete
- **TypeScript** is the language (no React/`.tsx` here — plain TS, simple).
  Electron apps are normally written in TS too.
- **Vite** builds that TS into a web bundle in `dist/`.
- **Vercel** hosts `dist/` as the website (browser edition).
- **Electron** loads the *same* `dist/` in a desktop window (download edition).

One codebase → a web app and a desktop app. You don't host Electron on Vercel; you
host the web edition there and ship the desktop edition as an installer.

### Deploy web (Vercel) + domain (Cloudflare)
1. Push to GitHub, import in Vercel. Build `npm run build:web`, output `dist`
   (already in `vercel.json`). Add the `VITE_SUPABASE_*` env vars in Vercel.
2. Vercel → Settings → Domains → add your domain. In Cloudflare DNS add the record
   Vercel shows (usually a `CNAME` to `cname.vercel-dns.com`), set to **DNS only
   (grey cloud)** first so the TLS cert can issue.

---

## Does the map show the *real* city? (geography: yes)

- **Roads, water, parks, land use, place names** come straight from OpenStreetMap
  — true positions and shapes, properly classified, same data class the big map
  apps use. Open `preview.html` and pan around: real Gaborone streets.
- **3D buildings** (in `preview-3d.html` / the built app) are real *as far as OSM
  has mapped them* — solid in the CBD and malls, patchy in residential/informal
  areas, heights often defaulted. That's the gap your production plan fills with
  Overture footprints, Microsoft AI road centerlines, and LiDAR heights.
- **Sculpted landmark models** (the individually-modelled stadiums in the Apple
  shots) are Apple's proprietary art layer. Vector tiles give accurate extruded
  *footprints*, not bespoke 3D models — add glTF models for hero landmarks later.
- **Curated pins** are approximate now; snap to exact OSM/Overture nodes (or your
  Supabase rows) for production.

Turn-by-turn nav (like the pink reference) is a natural next layer — OSRM already
returns step maneuvers; today the app draws the route line with distance + ETA.

---

## 2D ↔ 3D and Blender landmark models

**Zoom behaviour (built in):** the map opens flat (2D, top-down) so you read the
whole city and its outline. As you zoom past ~z13.5 it auto-tilts and building
footprints rise into 3D extrusions; zoom back out and it flattens. Tilt manually
any time (right-drag / two-finger drag) and the auto-tilt backs off. The 3D button
re-engages it.

**Where 3D comes from:**
- *Base buildings* — extruded automatically from OSM/Overture footprints by
  MapLibre. No Blender, no modelling. This is most of the city.
- *Hero landmarks* — the sculpted, recognisable models (stadium, monument,
  parliament) are the only place Blender comes in. Model them in Blender, export
  glTF 2.0 (`.glb`) into `public/models/`, and register with `addModel(...)` (see
  `src/map/models.ts` and `public/models/README.md`). They render as real 3D
  objects anchored to true coordinates, on top of the live map.

Don't model the whole city in Blender — that's what the OSM/Overture data is for.
Blender is the cherry on top, not the cake.

---

## Accounts, profile & security

**Profile section** (tap the avatar, top of the panel): Profile, Settings,
Privacy Policy, Terms of Use, and Share. Settings drives the live map (theme,
distance units) and the data-contribution consent toggle.

**Auth:** Supabase passwordless email (magic link). On first sign-in a row is
created in `profiles` (see migration `0002`). Display name + preferences sync to
that row; signed out, preferences fall back to `localStorage`.

**Security model:**
- **RLS everywhere.** `pois` = public read, no client writes. `profiles` = each
  user can read/write only their own row (`auth.uid() = id`). `submissions` =
  insert-only, allowed only for an authenticated user with `consent = true` and
  `created_by = auth.uid()`; no client read.
- **Rate limiting (defence in depth):**
  1. *Database* — a `before insert` trigger caps place submissions at 20/hour/user
     (`check_submission_rate`). Tune the number in migration `0002`.
  2. *Platform* — Supabase enforces auth + API rate limits per project.
  3. *Edge* — add a Cloudflare WAF **rate-limiting rule** on your API hostname
     (e.g. 100 req/min/IP) once the domain is proxied through Cloudflare.
- **Consent** is recorded on every submission and mirrored on the profile; the
  client refuses to submit without it and RLS refuses it again server-side.

Migrations: `npx supabase db push` applies `0001` (schema + PostGIS) and `0002`
(profiles, hardened submissions, rate limiting). Enable Email auth in the Supabase
dashboard (Authentication → Providers).
