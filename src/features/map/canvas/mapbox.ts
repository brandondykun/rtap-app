import Mapbox, { Logger } from '@rnmapbox/maps';

import { getMapboxToken } from '@/config/env';
import type { Basemap } from '@/stores/settings';

import { isTileLoadFailure } from './mapbox-logs';

// Runs once, on first import, before any MapView mounts. MapScreen shows an error screen
// instead of the map when the token is missing.
const token = getMapboxToken();
if (token) Mapbox.setAccessToken(token);
// Returning true swallows the log; everything else keeps Mapbox's default console output.
Logger.setLogCallback(isTileLoadFailure);

/** Mapbox style for each basemap choice in the Layers panel. */
// Pinned to current Mapbox styles (the library's StyleURL constants point at older versions).
export const BASEMAP_STYLE_URLS: Record<Basemap, string> = {
  satellite: Mapbox.StyleURL.Satellite,
  hybrid: 'mapbox://styles/mapbox/satellite-streets-v12',
  topo: 'mapbox://styles/mapbox/outdoors-v12',
  dark: 'mapbox://styles/mapbox/dark-v11',
};

export const BASEMAP_LABELS: Record<Basemap, string> = { satellite: 'Satellite', hybrid: 'Hybrid', topo: 'Topo', dark: 'Dark' };

/** Default style (offline tile packs use it until downloads get a basemap choice). */
export const MAP_STYLE_URL: string = BASEMAP_STYLE_URLS.satellite;
