import type { StyleSpecification } from 'maplibre-gl';

export type Theme = 'dark' | 'light';

/** OpenFreeMap — free, no API key, unmodified OpenMapTiles schema. */
export const LIBERTY = 'https://tiles.openfreemap.org/styles/liberty';
const FALLBACK_GLYPHS = 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf';
const FALLBACK_SOURCES = { openmaptiles: { type: 'vector', url: 'https://tiles.openfreemap.org/planet' } };

export const CENTER: [number, number] = [25.91222, -24.65806];
export const BOUNDS: [[number, number], [number, number]] = [[25.745, -24.835], [26.005, -24.515]];

type Palette = Record<string, string>;
const PALETTE: Record<Theme, Palette> = {
  dark: {
    bg: '#0d0f12', water: '#171a20', green: '#13161b', luA: '#101318', luB: '#121620', aero: '#191d24',
    rMaj: '#5b636e', rMed: '#3f454e', rMin: '#2c3138', path: '#2b3038', rail: '#363c44',
    bLo: '#1b1f26', bMi: '#262b34', bHi: '#343b46', bF: '#15181e',
    boundary: '#2b3039', rLab: '#7d8794', rLabH: '#0d0f12', city: '#eef1f4', town: '#cdd3da',
    sub: '#99a2ad', labH: '#0b0d10', wLab: '#5d6b78'
  },
  light: {
    bg: '#eef0f3', water: '#d4dbe2', green: '#e6eaed', luA: '#eceef1', luB: '#e9ecf0', aero: '#e2e6ea',
    rMaj: '#ffffff', rMed: '#ffffff', rMin: '#f8fafb', path: '#cfd5db', rail: '#b8bfc7',
    bLo: '#dfe3e8', bMi: '#d2d7de', bHi: '#c2c8d0', bF: '#e1e4e9',
    boundary: '#c2c8d0', rLab: '#5c6570', rLabH: '#ffffff', city: '#1f2530', town: '#3a414c',
    sub: '#69717c', labH: '#ffffff', wLab: '#7e8a96'
  }
};

let FONTS = { regular: ['Noto Sans Regular'] as string[], bold: ['Noto Sans Bold'] as string[] };

function pickFonts(base: any) {
  const set = new Set<string>();
  (base?.layers || []).forEach((l: any) => {
    const f = l.layout && l.layout['text-font'];
    if (Array.isArray(f)) f.forEach((x: string) => set.add(x));
  });
  const arr = [...set];
  const reg = arr.find(f => /regular/i.test(f)) || arr.find(f => !/bold|italic/i.test(f)) || arr[0] || 'Noto Sans Regular';
  const bold = arr.find(f => /bold/i.test(f) && !/italic/i.test(f)) || reg;
  FONTS = { regular: [reg], bold: [bold] };
}

const exp = (...stops: number[]): any => {
  const e: any[] = ['interpolate', ['linear'], ['zoom']];
  for (let i = 0; i < stops.length; i += 2) e.push(stops[i], stops[i + 1]);
  return e;
};
const isClass = (...vals: string[]): any => ['match', ['get', 'class'], vals, true, false];
const src = 'openmaptiles';

function buildLayers(c: Palette): any[] {
  return [
    { id: 'bg', type: 'background', paint: { 'background-color': c.bg } },
    { id: 'landuse', type: 'fill', source: src, 'source-layer': 'landuse',
      paint: { 'fill-color': ['match', ['get', 'class'], ['residential', 'suburb'], c.luA, c.luB], 'fill-opacity': .5 } },
    { id: 'park', type: 'fill', source: src, 'source-layer': 'park',
      paint: { 'fill-color': c.green, 'fill-opacity': .7 } },
    { id: 'landcover-wood', type: 'fill', source: src, 'source-layer': 'landcover',
      filter: isClass('wood', 'grass', 'scrub'), paint: { 'fill-color': c.green, 'fill-opacity': .45 } },
    { id: 'water', type: 'fill', source: src, 'source-layer': 'water',
      paint: { 'fill-color': c.water } },
    { id: 'aeroway-fill', type: 'fill', source: src, 'source-layer': 'aeroway',
      filter: ['==', ['geometry-type'], 'Polygon'], paint: { 'fill-color': c.aero } },

    { id: 'r-path', type: 'line', source: src, 'source-layer': 'transportation',
      filter: isClass('path', 'track'), layout: { 'line-cap': 'round' },
      paint: { 'line-color': c.path, 'line-width': exp(14, .6, 18, 2, 20, 4), 'line-dasharray': [2, 2.2], 'line-opacity': .85 } },
    { id: 'r-rail', type: 'line', source: src, 'source-layer': 'transportation',
      filter: isClass('rail', 'transit'), paint: { 'line-color': c.rail, 'line-width': exp(11, .6, 16, 1.8, 20, 4.5), 'line-dasharray': [3, 3] } },
    { id: 'r-min', type: 'line', source: src, 'source-layer': 'transportation', minzoom: 12,
      filter: isClass('minor', 'service'), layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': c.rMin, 'line-width': exp(12, .5, 14, 1.2, 16, 3, 20, 12) } },
    { id: 'r-med', type: 'line', source: src, 'source-layer': 'transportation',
      filter: isClass('secondary', 'tertiary'), layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': c.rMed, 'line-width': exp(9, .5, 13, 1.5, 16, 5, 20, 18) } },
    { id: 'r-maj', type: 'line', source: src, 'source-layer': 'transportation',
      filter: isClass('motorway', 'trunk', 'primary'), layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': c.rMaj, 'line-width': exp(6, .5, 10, 1.2, 13, 3, 16, 8, 20, 30) } },

    { id: 'building-flat', type: 'fill', source: src, 'source-layer': 'building', minzoom: 12, maxzoom: 15.2,
      paint: { 'fill-color': c.bF, 'fill-opacity': ['interpolate', ['linear'], ['zoom'], 12, 0, 13.5, .6, 15, .3] } },
    { id: 'building-3d', type: 'fill-extrusion', source: src, 'source-layer': 'building', minzoom: 13.5,
      paint: {
        'fill-extrusion-color': ['interpolate', ['linear'],
          ['coalesce', ['get', 'render_height'], ['get', 'height'], 4], 0, c.bLo, 25, c.bMi, 90, c.bHi],
        'fill-extrusion-height': ['interpolate', ['linear'], ['zoom'], 13.8, 0, 15.6,
          ['coalesce', ['get', 'render_height'], ['get', 'height'], 4]],
        'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], ['get', 'min_height'], 0],
        'fill-extrusion-opacity': ['interpolate', ['linear'], ['zoom'], 13.8, 0, 14.8, .92],
        'fill-extrusion-vertical-gradient': true
      } },

    { id: 'boundary', type: 'line', source: src, 'source-layer': 'boundary',
      filter: ['<=', ['get', 'admin_level'], 6],
      paint: { 'line-color': c.boundary, 'line-width': exp(6, .4, 12, 1, 16, 1.6), 'line-dasharray': [3, 2], 'line-opacity': .55 } },

    { id: 'lbl-road', type: 'symbol', source: src, 'source-layer': 'transportation_name', minzoom: 13,
      layout: { 'symbol-placement': 'line', 'text-field': ['coalesce', ['get', 'name:latin'], ['get', 'name']],
        'text-font': FONTS.regular, 'text-size': exp(13, 9, 18, 12), 'text-letter-spacing': .02 },
      paint: { 'text-color': c.rLab, 'text-halo-color': c.rLabH, 'text-halo-width': 1.4 } },
    { id: 'lbl-place', type: 'symbol', source: src, 'source-layer': 'place',
      filter: isClass('city', 'town', 'village', 'suburb', 'neighbourhood'),
      layout: { 'text-field': ['coalesce', ['get', 'name:latin'], ['get', 'name']], 'text-font': FONTS.bold,
        'text-size': ['match', ['get', 'class'], 'city', exp(8, 15, 14, 23), 'town', exp(9, 12, 14, 17), exp(11, 10, 15, 13)],
        'text-max-width': 8 },
      paint: { 'text-color': ['match', ['get', 'class'], 'city', c.city, 'town', c.town, c.sub],
        'text-halo-color': c.labH, 'text-halo-width': 1.6 } }
  ];
}

/** Fetch Liberty once to inherit correct sources + glyphs, then repaint monochrome. */
export async function buildStyle(theme: Theme): Promise<StyleSpecification | string> {
  try {
    const base = await (await fetch(LIBERTY, { cache: 'force-cache' })).json();
    pickFonts(base);
    return {
      version: 8,
      glyphs: base.glyphs || FALLBACK_GLYPHS,
      sources: base.sources || FALLBACK_SOURCES,
      layers: buildLayers(PALETTE[theme])
    } as StyleSpecification;
  } catch {
    // network blocked the style fetch — fall back to a known-good grayscale style
    return theme === 'dark'
      ? 'https://tiles.openfreemap.org/styles/positron'
      : 'https://tiles.openfreemap.org/styles/positron';
  }
}

export function styleFor(theme: Theme): StyleSpecification {
  return {
    version: 8,
    glyphs: FALLBACK_GLYPHS,
    sources: FALLBACK_SOURCES,
    layers: buildLayers(PALETTE[theme])
  } as StyleSpecification;
}
