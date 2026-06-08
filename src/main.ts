import './style.css';
import { initMap, showFallbackMap } from './map/app';
import { loadPois } from './data/supabase';
import { initProfile } from './ui/profile';
import { initPandoraCookieBanner, trackPandora } from './pandora';

initProfile();
initPandoraCookieBanner();

// Load curated places (from Supabase/Postgres if configured, else the bundled
// list), then boot the map. See README for Supabase + migrations.
loadPois()
  .then(async (pois) => {
    await initMap(pois);
    void trackPandora('map.viewed', { center: [25.9231, -24.6282], zoom: 12.25 });
  })
  .catch((err) => {
    console.error('Failed to start map:', err);
    showFallbackMap('startup_failed');
  });
