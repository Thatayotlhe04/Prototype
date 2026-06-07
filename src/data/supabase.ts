import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { POIS, type Poi } from '../map/pois';

const url = import.meta.env.VITE_SUPABASE_URL;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;

// The anon key is meant to be public; access is governed by Row Level Security
// (see supabase/migrations/0001_init.sql), not by hiding the key.
let client: SupabaseClient | null = null;
function db(): SupabaseClient | null {
  if (client) return client;
  if (!url || !anon) return null; // not wired yet -> run on the bundled list
  client = createClient(url, anon);
  return client;
}

interface PoiRow { name: string; cat: string; lng: number; lat: number; q: string | null; }
const toPoi = (r: PoiRow): Poi => ({ name: r.name, cat: r.cat as Poi['cat'], c: [r.lng, r.lat], q: r.q ?? '' });

/** Load curated places from Postgres, falling back to the bundled list. */
export async function loadPois(): Promise<Poi[]> {
  const sb = db();
  if (!sb) return POIS;
  const { data, error } = await sb.from('pois').select('name,cat,lng,lat,q');
  if (error || !data?.length) {
    if (error) console.warn('[supabase] loadPois fell back to bundled list:', error.message);
    return POIS;
  }
  return (data as PoiRow[]).map(toPoi);
}

/**
 * PostGIS radius query — the thing Firestore can't do natively.
 * Returns curated places within `radiusM` metres of a point, nearest first.
 */
export async function placesWithin(lng: number, lat: number, radiusM = 3000): Promise<Poi[]> {
  const sb = db();
  if (!sb) return POIS;
  const { data, error } = await sb.rpc('places_within', { in_lng: lng, in_lat: lat, radius_m: radiusM });
  if (error || !data) return POIS;
  return (data as PoiRow[]).map(toPoi);
}

/**
 * The product's data-collection point. Inserts a user-submitted place ONLY with
 * explicit consent AND an authenticated session — the lawful-basis hook for
 * Botswana's Data Protection Act, plus accountability for rate limiting.
 * RLS additionally refuses any row where consent !== true or created_by != uid.
 */
export async function submitPlace(
  place: { name: string; lng: number; lat: number; note?: string },
  consent: boolean
): Promise<{ ok: boolean; reason?: string }> {
  if (!consent) return { ok: false, reason: 'consent_required' };
  const sb = db();
  if (!sb) return { ok: false, reason: 'supabase_not_configured' };
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false, reason: 'sign_in_required' };
  const { error } = await sb.from('submissions').insert({ ...place, consent: true, created_by: user.id });
  if (!error) return { ok: true };
  return { ok: false, reason: /rate_limit/.test(error.message) ? 'rate_limited' : error.message };
}

/* ===================== auth ===================== */
export interface Profile { id: string; display_name: string | null; units: 'km' | 'mi'; theme: 'dark' | 'light'; data_consent: boolean; }

export async function signInWithEmail(email: string): Promise<{ ok: boolean; reason?: string }> {
  const sb = db(); if (!sb) return { ok: false, reason: 'supabase_not_configured' };
  const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } });
  return error ? { ok: false, reason: error.message } : { ok: true };
}
export async function signOut(): Promise<void> { const sb = db(); if (sb) await sb.auth.signOut(); }

/** Subscribe to auth state. Returns an unsubscribe fn. Fires immediately with the current user. */
export function onAuth(cb: (user: { id: string; email?: string } | null) => void): () => void {
  const sb = db();
  if (!sb) { cb(null); return () => {}; }
  sb.auth.getUser().then(({ data }) => cb(data.user ? { id: data.user.id, email: data.user.email ?? undefined } : null));
  const { data } = sb.auth.onAuthStateChange((_e, session) =>
    cb(session?.user ? { id: session.user.id, email: session.user.email ?? undefined } : null));
  return () => data.subscription.unsubscribe();
}

export async function getProfile(): Promise<Profile | null> {
  const sb = db(); if (!sb) return null;
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const { data } = await sb.from('profiles').select('id,display_name,units,theme,data_consent').eq('id', user.id).maybeSingle();
  return (data as Profile) ?? null;
}
export async function saveProfile(patch: Partial<Omit<Profile, 'id'>>): Promise<{ ok: boolean; reason?: string }> {
  const sb = db(); if (!sb) return { ok: false, reason: 'supabase_not_configured' };
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false, reason: 'sign_in_required' };
  const { error } = await sb.from('profiles').upsert({ id: user.id, ...patch }, { onConflict: 'id' });
  return error ? { ok: false, reason: error.message } : { ok: true };
}
