export type Category =
  | 'monument' | 'landmark' | 'shopping' | 'transit' | 'airport'
  | 'education' | 'sport' | 'nature' | 'water' | 'hotel';

export interface Poi {
  name: string;
  cat: Category;
  /** [lng, lat] — MapLibre / GeoJSON order */
  c: [number, number];
  /** extra search keywords */
  q: string;
}

/**
 * Curated, well-known Gaborone places. Coordinates are hand-placed for the
 * prototype and should be snapped to exact OSM / Overture nodes in production
 * (or, once live, pulled from Firestore — see src/data/firebase.ts).
 */
export const POIS: Poi[] = [
  { name: 'Three Dikgosi Monument', cat: 'monument', c: [25.9186, -24.6554], q: 'dikgosi three chiefs cbd' },
  { name: 'Parliament of Botswana', cat: 'monument', c: [25.9135, -24.6566], q: 'national assembly parliament government' },
  { name: 'Main Mall', cat: 'landmark', c: [25.9119, -24.6571], q: 'main mall pedestrian government enclave' },
  { name: 'Game City Mall', cat: 'shopping', c: [25.8950, -24.6826], q: 'game city shopping kgale' },
  { name: 'Riverwalk Mall', cat: 'shopping', c: [25.9520, -24.6610], q: 'riverwalk shopping tlokweng road' },
  { name: 'Airport Junction Mall', cat: 'shopping', c: [25.9165, -24.6082], q: 'airport junction shopping' },
  { name: 'Rail Park Mall', cat: 'shopping', c: [25.9115, -24.6505], q: 'rail park station shopping' },
  { name: 'Gaborone Station', cat: 'transit', c: [25.9117, -24.6539], q: 'railway train station' },
  { name: 'Sir Seretse Khama Int’l Airport', cat: 'airport', c: [25.9182, -24.5553], q: 'airport gbe flight' },
  { name: 'University of Botswana', cat: 'education', c: [25.9384, -24.6644], q: 'ub university campus' },
  { name: 'Botswana National Stadium', cat: 'sport', c: [25.9249, -24.6478], q: 'national stadium football' },
  { name: 'Kgale Hill', cat: 'nature', c: [25.8836, -24.6925], q: 'kgale hill summit hike viewpoint' },
  { name: 'Gaborone Dam', cat: 'water', c: [25.9000, -24.7167], q: 'dam reservoir notwane' },
  { name: 'National Botanical Garden', cat: 'nature', c: [25.9230, -24.6470], q: 'botanical garden' },
  { name: 'Avani Gaborone', cat: 'hotel', c: [25.9290, -24.6530], q: 'avani gaborone sun hotel casino' },
  { name: 'Gaborone Game Reserve', cat: 'nature', c: [25.9600, -24.6500], q: 'game reserve wildlife' }
];

const ICON: Record<string, string> = {
  monument: '<path d="M3 21h18M5 21V10m14 11V10M4 10l8-6 8 6M9 21v-6h6v6"/>',
  landmark: '<path d="M4 21h16M6 21V9m12 12V9M3 9l9-6 9 6M10 21v-7h4v7"/>',
  shopping: '<path d="M5 8h14l-1.2 12H6.2L5 8zM8.5 8V6.2a3.5 3.5 0 017 0V8"/>',
  transit: '<rect x="6" y="3" width="12" height="13" rx="2.5"/><path d="M6 11h12M8.5 21l-1.8 2M15.5 21l1.8 2"/><circle cx="9" cy="13.5" r=".9"/><circle cx="15" cy="13.5" r=".9"/>',
  airport: '<path d="M21 6.5 9.8 13.3l-4.6-1.3-2 1.2 3.4 2.3.6 3.9 1.6-1.3.9-3.4L21 6.5z"/>',
  education: '<path d="M2.5 8.5 12 4.5l9.5 4-9.5 4-9.5-4zM6 11v4.4c0 1 2.7 2.6 6 2.6s6-1.6 6-2.6V11"/>',
  sport: '<ellipse cx="12" cy="12" rx="9" ry="6"/><path d="M7.5 12a4.5 2.6 0 019 0"/>',
  nature: '<path d="M2.5 20h19L14.5 7l-3.4 5.6-2-2.6L2.5 20z"/>',
  water: '<path d="M12 3.2s6 6.7 6 10.6a6 6 0 11-12 0c0-3.9 6-10.6 6-10.6z"/>',
  hotel: '<path d="M3 19v-7m0 7h18v-3a4 4 0 00-4-4H3M3 12V8m4 3V9.5A1.5 1.5 0 018.5 8H12a1.5 1.5 0 011.5 1.5V11"/>',
  default: '<circle cx="12" cy="12" r="3.2"/>'
};

export const svgIcon = (cat: string, sz: number): string =>
  `<svg width="${sz}" height="${sz}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${ICON[cat] || ICON.default}</svg>`;
