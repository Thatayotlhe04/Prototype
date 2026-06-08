import maplibregl from 'maplibre-gl';
import { buildStyle, CENTER, BOUNDS, type Theme } from './style';
import { svgIcon, type Poi } from './pois';
import { modelTrainingEnabled, trackPandora } from '../pandora';

let map: maplibregl.Map;
let theme: Theme = 'dark';
let mode: 'explore' | 'directions' = 'explore';
let pois: Poi[] = [];

const markers: { el: HTMLElement; poi: Poi; marker: maplibregl.Marker }[] = [];
let routeA: [number, number] | null = null;
let routeB: [number, number] | null = null;
const abMarkers: { a: maplibregl.Marker | null; b: maplibregl.Marker | null } = { a: null, b: null };
let routeData: GeoJSON.FeatureCollection | GeoJSON.Feature = { type: 'FeatureCollection', features: [] };

const $ = (id: string) => document.getElementById(id);
let fallbackStarted = false;

export function showFallbackMap(reason = 'map_engine_unavailable') {
  if (fallbackStarted) return;
  fallbackStarted = true;
  console.warn(`[map] switching to fallback map: ${reason}`);
  window.location.replace(new URL('fallback-map.html', window.location.href));
}

function armMapFallback(reason: string, delay = 3500) {
  window.clearTimeout((armMapFallback as any).timer);
  (armMapFallback as any).timer = window.setTimeout(() => showFallbackMap(reason), delay);
  return () => window.clearTimeout((armMapFallback as any).timer);
}

let unitMode: 'km' | 'mi' = 'km';
const fmtDist = (m: number) => unitMode === 'mi'
  ? (m < 1609 ? `${Math.round(m * 3.281)} ft` : `${(m / 1609.34).toFixed(1)} mi`)
  : (m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`);
const fmtTime = (s: number) => { const m = Math.round(s / 60); return m < 60 ? `${m} min` : `${Math.floor(m / 60)}h ${m % 60}m`; };

export async function initMap(loaded: Poi[]) {
  const supported = (maplibregl as any).supported?.({ failIfMajorPerformanceCaveat: false }) ?? true;
  if (!supported) {
    showFallbackMap('webgl_not_supported');
    return;
  }

  const clearFallback = armMapFallback('map_load_timeout');
  pois = loaded;
  const style = await buildStyle('dark');

  map = new maplibregl.Map({
    container: 'map',
    style,
    center: CENTER,
    zoom: 12.2,
    pitch: 0,
    bearing: 0,
    maxPitch: 70,
    minZoom: 10.6,
    maxZoom: 18.5,
    maxBounds: BOUNDS as maplibregl.LngLatBoundsLike,
    antialias: true,
    attributionControl: false
  });
  map.dragRotate.enable();
  map.touchZoomRotate.enableRotation();

  // 2D when zoomed out, tilt into 3D as you zoom in (until the user tilts manually).
  map.on('pitchstart', (e: any) => { if (e && e.originalEvent) userPitched = true; });
  map.on('zoom', () => {
    if (userPitched || !is3DAuto) return;
    const z = map.getZoom();
    const target = z <= 13 ? 0 : Math.min(58, ((z - 13) / (15.6 - 13)) * 58);
    if (Math.abs(target - map.getPitch()) > 0.5) map.setPitch(target);
  });

  map.on('load', () => {
    addRouteLayers();
    addMarkers();
    buildList(pois);
  });

  map.once('idle', clearFallback);

  map.on('error', (event: any) => {
    const message = String(event?.error?.message || '');
    if (/style|source|webgl|context|worker/i.test(message)) showFallbackMap(message);
  });

  map.on('rotate', () => {
    const ic = $('compassIcon');
    if (ic) ic.style.transform = `rotate(${-map.getBearing()}deg)`;
  });
  map.on('mousemove', (e) => {
    const c = $('coords');
    if (c) c.textContent = `${Math.abs(e.lngLat.lat).toFixed(4)}°S  ${Math.abs(e.lngLat.lng).toFixed(4)}°E`;
  });
  map.on('click', (e) => { if (mode === 'directions') onPick([e.lngLat.lng, e.lngLat.lat]); });

  wireControls();
  wireSearch();
}

/* ---- route source + layers ---- */
function addRouteLayers() {
  if (!map.getSource('route')) {
    map.addSource('route', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
  }
  const col = theme === 'dark' ? '#ffffff' : '#14181d';
  if (!map.getLayer('route-glow')) {
    map.addLayer({ id: 'route-glow', type: 'line', source: 'route',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': col, 'line-width': 11, 'line-opacity': 0.16, 'line-blur': 3 } });
  }
  if (!map.getLayer('route-line')) {
    map.addLayer({ id: 'route-line', type: 'line', source: 'route',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': col, 'line-width': 3.4, 'line-opacity': 0.95 } });
  }
}
function setRouteData(d: GeoJSON.FeatureCollection | GeoJSON.Feature) {
  routeData = d;
  const s = map.getSource('route') as maplibregl.GeoJSONSource | undefined;
  if (s) s.setData(d as any);
}

/* ---- markers ---- */
function addMarkers() {
  pois.forEach((p) => {
    const el = document.createElement('div');
    el.className = 'pin';
    el.innerHTML = `<div class="pin-dot">${svgIcon(p.cat, 15)}</div><div class="pin-label">${p.name}</div>`;
    el.addEventListener('click', (ev) => { ev.stopPropagation(); openPoi(p, el); });
    const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' }).setLngLat(p.c).addTo(map);
    markers.push({ el, poi: p, marker });
  });
}
function openPoi(p: Poi, el: HTMLElement) {
  markers.forEach((m) => m.el.classList.remove('active'));
  el.classList.add('active');
  const safe = p.name.replace(/'/g, '&#39;');
  const html = `<div class="pop"><div class="pnm">${p.name}</div><div class="psub">${p.cat}</div>
    <div class="pbtns">
      <button class="pbtn" data-leg="a" data-lng="${p.c[0]}" data-lat="${p.c[1]}" data-name="${safe}">Start</button>
      <button class="pbtn p" data-leg="b" data-lng="${p.c[0]}" data-lat="${p.c[1]}" data-name="${safe}">End</button>
    </div></div>`;
  const popup = new maplibregl.Popup({ offset: 26, closeButton: true, maxWidth: '230px' })
    .setLngLat(p.c).setHTML(html).addTo(map);
  popup.getElement().querySelectorAll<HTMLButtonElement>('.pbtn').forEach((b) => {
    b.addEventListener('click', () => {
      setLeg(b.dataset.leg as 'a' | 'b', [Number(b.dataset.lng), Number(b.dataset.lat)], p.name);
      popup.remove();
    });
  });
  map.flyTo({ center: p.c, zoom: Math.max(map.getZoom(), 14.5), duration: 800 });
}

/* ---- search ---- */
function fuzzy(q: string): Poi[] {
  q = q.trim().toLowerCase();
  if (!q) return pois;
  return pois.filter((p) => (p.name + ' ' + p.cat + ' ' + p.q).toLowerCase().includes(q));
}
function buildList(list: Poi[]) {
  const box = $('results');
  if (!box) return;
  if (!list.length) { box.innerHTML = '<div class="empty">No matches in Gaborone.</div>'; return; }
  box.innerHTML = list.map((p) => {
    const i = pois.indexOf(p);
    return `<div class="row" data-i="${i}"><div class="ic">${svgIcon(p.cat, 17)}</div>
      <div><div class="nm">${p.name}</div><div class="sub">${p.cat}</div></div></div>`;
  }).join('');
  box.querySelectorAll<HTMLElement>('.row').forEach((row) => {
    row.addEventListener('click', () => {
      const i = Number(row.dataset.i);
      const p = pois[i]; const m = markers[i];
      map.flyTo({ center: p.c, zoom: 15, duration: 800 });
      if (m) setTimeout(() => openPoi(p, m.el), 350);
    });
  });
}
function wireSearch() {
  const input = $('search') as HTMLInputElement | null;
  if (input) input.addEventListener('input', () => {
    const list = fuzzy(input.value);
    buildList(list);
    const query = input.value.trim();
    if (query.length >= 2) {
      void trackPandora('location.searched', {
        ...(modelTrainingEnabled() ? { query } : {}),
        resultCount: list.length,
      });
    }
  });
}

/* ---- mode ---- */
function setMode(m: 'explore' | 'directions') {
  mode = m;
  $('segExplore')?.classList.toggle('on', m === 'explore');
  $('segDir')?.classList.toggle('on', m === 'directions');
  const ev = $('exploreView'); if (ev) ev.style.display = m === 'explore' ? 'block' : 'none';
  $('dirsView')?.classList.toggle('on', m === 'directions');
  map.getCanvas().style.cursor = m === 'directions' ? 'crosshair' : '';
}

/* ---- routing ---- */
function onPick(c: [number, number]) {
  if (!routeA) setLeg('a', c, 'Dropped pin');
  else if (!routeB) setLeg('b', c, 'Dropped pin');
}
function setLeg(which: 'a' | 'b', c: [number, number], label: string) {
  if (which === 'a') routeA = c; else routeB = c;
  const leg = $(which === 'a' ? 'legA' : 'legB');
  leg?.classList.add('set');
  const t = $(which === 'a' ? 'legAtxt' : 'legBtxt'); if (t) t.textContent = label;
  if (abMarkers[which]) abMarkers[which]!.remove();
  const el = document.createElement('div'); el.className = 'pin active';
  el.innerHTML = `<div class="pin-dot" style="border-radius:50%">${which.toUpperCase()}</div>`;
  abMarkers[which] = new maplibregl.Marker({ element: el, anchor: 'bottom' }).setLngLat(c).addTo(map);
  const rb = $('routeBtn') as HTMLButtonElement | null;
  if (rb) rb.disabled = !(routeA && routeB);
  if (mode !== 'directions') setMode('directions');
  if (routeA && routeB) runRoute();
}
async function runRoute() {
  if (!(routeA && routeB)) return;
  $('result')?.classList.add('on');
  const dEl = $('rDist'), tEl = $('rTime'), nEl = $('rNote');
  if (dEl) dEl.textContent = '…'; if (tEl) tEl.textContent = '…'; if (nEl) nEl.textContent = '';
  const coords = `${routeA[0]},${routeA[1]};${routeB[0]},${routeB[1]}`;
  try {
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), 8000);
    const r = await (await fetch(
      `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`,
      { signal: ctrl.signal }
    )).json();
    if (r.code === 'Ok' && r.routes?.[0]) {
      const rt = r.routes[0];
      setRouteData({ type: 'Feature', geometry: rt.geometry, properties: {} });
      if (dEl) dEl.textContent = fmtDist(rt.distance);
      if (tEl) tEl.textContent = fmtTime(rt.duration);
      fitRoute(rt.geometry.coordinates);
      return;
    }
    throw new Error('no route');
  } catch {
    const d = haversine(routeA, routeB);
    setRouteData({ type: 'Feature', geometry: { type: 'LineString', coordinates: [routeA, routeB] }, properties: {} });
    if (dEl) dEl.textContent = '~' + fmtDist(d);
    if (tEl) tEl.textContent = '~' + fmtTime(d / 8.3);
    if (nEl) nEl.textContent = 'Straight-line estimate (live router busy — self-host OSRM in production).';
    fitRoute([routeA, routeB]);
  }
}
function fitRoute(coords: [number, number][]) {
  const b = coords.reduce((bb, c) => bb.extend(c as maplibregl.LngLatLike),
    new maplibregl.LngLatBounds(coords[0] as maplibregl.LngLatLike, coords[0] as maplibregl.LngLatLike));
  map.fitBounds(b, { padding: { top: 90, bottom: 90, left: 380, right: 90 }, pitch: 0, duration: 900 });
}
function clearRoute() {
  routeA = routeB = null;
  (['a', 'b'] as const).forEach((w) => { if (abMarkers[w]) { abMarkers[w]!.remove(); abMarkers[w] = null; } });
  setRouteData({ type: 'FeatureCollection', features: [] });
  $('legA')?.classList.remove('set'); $('legB')?.classList.remove('set');
  const a = $('legAtxt'); if (a) a.textContent = 'Set start point';
  const b = $('legBtxt'); if (b) b.textContent = 'Set destination';
  $('result')?.classList.remove('on');
  const rb = $('routeBtn') as HTMLButtonElement | null; if (rb) rb.disabled = true;
}
function haversine(a: [number, number], b: [number, number]) {
  const R = 6371000, toR = (x: number) => (x * Math.PI) / 180;
  const dLat = toR(b[1] - a[1]), dLon = toR(b[0] - a[0]);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toR(a[1])) * Math.cos(toR(b[1])) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/* ---- controls + theme ---- */
let is3D = false;
let userPitched = false;
let is3DAuto = true;
function wireControls() {
  $('zoomIn')?.addEventListener('click', () => map.zoomIn());
  $('zoomOut')?.addEventListener('click', () => map.zoomOut());
  $('compass')?.addEventListener('click', () => map.easeTo({ bearing: 0, duration: 500 }));
  $('pitch')?.addEventListener('click', () => {
    is3D = !is3D;
    if (is3D) { userPitched = false; is3DAuto = true; const z = map.getZoom(); map.easeTo({ pitch: Math.max(35, Math.min(58, ((z - 13) / 2.6) * 58)), zoom: Math.max(z, 14.4), duration: 600 }); }
    else { is3DAuto = false; userPitched = false; map.easeTo({ pitch: 0, duration: 600 }); }
  });
  $('locate')?.addEventListener('click', locate);
  $('theme')?.addEventListener('click', toggleTheme);
  $('clearBtn')?.addEventListener('click', clearRoute);
  $('routeBtn')?.addEventListener('click', runRoute);
  $('segExplore')?.addEventListener('click', () => setMode('explore'));
  $('segDir')?.addEventListener('click', () => setMode('directions'));
}
function locate() {
  if (!navigator.geolocation) return;
  navigator.geolocation.getCurrentPosition((pos) => {
    const c: [number, number] = [pos.coords.longitude, pos.coords.latitude];
    const inBox = c[0] > BOUNDS[0][0] && c[0] < BOUNDS[1][0] && c[1] > BOUNDS[0][1] && c[1] < BOUNDS[1][1];
    if (!inBox) { alert('This prototype is locked to Gaborone — you appear to be outside the city bounds.'); return; }
    const el = document.createElement('div'); el.className = 'pin active';
    el.innerHTML = '<div class="pin-dot" style="border-radius:50%"><span style="width:8px;height:8px;border-radius:50%;background:var(--map-bg);display:block"></span></div><div class="pin-label">You are here</div>';
    new maplibregl.Marker({ element: el, anchor: 'bottom' }).setLngLat(c).addTo(map);
    map.flyTo({ center: c, zoom: 15, duration: 900 });
  }, () => {}, { enableHighAccuracy: true, timeout: 7000 });
}
async function applyTheme(next: Theme) {
  if (next === theme && document.body.dataset.theme === next) return;
  theme = next;
  document.body.dataset.theme = theme;
  const ic = $('themeIcon');
  if (ic) ic.innerHTML = theme === 'dark'
    ? '<path d="M21 12.8A8.5 8.5 0 1 1 11.2 3 6.6 6.6 0 0 0 21 12.8z"/>'
    : '<circle cx="12" cy="12" r="4.2"/><path d="M12 2v2.2M12 19.8V22M4.5 4.5 6 6M18 18l1.5 1.5M2 12h2.2M19.8 12H22M4.5 19.5 6 18M18 6l1.5-1.5"/>';
  const style = await buildStyle(theme);
  map.setStyle(style as any);
  map.once('idle', () => { addRouteLayers(); setRouteData(routeData); });
}
async function toggleTheme() { applyTheme(theme === 'dark' ? 'light' : 'dark'); }

// Settings bridge — the profile/settings panel drives these via window events.
window.addEventListener('app:theme', (e: any) => applyTheme(e.detail === 'light' ? 'light' : 'dark'));
window.addEventListener('app:units', (e: any) => { unitMode = e.detail === 'mi' ? 'mi' : 'km'; });
