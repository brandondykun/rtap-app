import Mapbox from '@rnmapbox/maps';

import { getMapboxToken } from '@/config/env';
import type { Basemap } from '@/stores/settings';

// Runs once, on first import, before any MapView mounts. MapScreen shows an error screen
// instead of the map when the token is missing.
const token = getMapboxToken();
if (token) Mapbox.setAccessToken(token);

/** Mapbox style for each basemap choice in the Layers panel. */
export const BASEMAP_STYLE_URLS: Record<Basemap, string> = {
  satellite: Mapbox.StyleURL.Satellite,
  hybrid: Mapbox.StyleURL.SatelliteStreet,
  topo: Mapbox.StyleURL.Outdoors,
  dark: Mapbox.StyleURL.Dark,
};

/** Default style (offline tile packs use it until downloads get a basemap choice). */
export const MAP_STYLE_URL: string = BASEMAP_STYLE_URLS.satellite;
