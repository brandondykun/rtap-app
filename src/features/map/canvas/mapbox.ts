import Mapbox from '@rnmapbox/maps';

import { getMapboxToken } from '@/config/env';

// Runs once, on first import, before any MapView mounts. MapScreen shows an error screen
// instead of the map when the token is missing.
const token = getMapboxToken();
if (token) Mapbox.setAccessToken(token);

export const MAP_STYLE_URL: string = Mapbox.StyleURL.Satellite;
