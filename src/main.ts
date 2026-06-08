import './style.css';
import { initMap, showFallbackMap } from './map/app';
import { loadPois } from './data/supabase';
import { initProfile } from './ui/profile';

initProfile();

// Load curated places (from Supabase/Postgres if configured, else the bundled
// list), then boot the map. See README for Supabase + migrations.
loadPois()
  .then((pois) => initMap(pois))
  .catch((err) => {
    console.error('Failed to start map:', err);
    showFallbackMap('startup_failed');
  });
