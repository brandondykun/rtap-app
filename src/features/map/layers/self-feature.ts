import type { LatLon } from '@/lib/geo/types';

import { MAP_IMAGE_IDS } from '../images/map-images';

type SelfIcon = (typeof MAP_IMAGE_IDS)['self' | 'selfNoHeading' | 'selfManual'];

export type SelfFeatureCollection = {
  type: 'FeatureCollection';
  features: {
    type: 'Feature';
    id: 'self';
    geometry: { type: 'Point'; coordinates: [number, number] };
    properties: { icon: SelfIcon; heading: number };
  }[];
};

/** One feature for the self icon; the no-heading and manual icons have no arrow or cone to rotate. */
export function selfFeatureCollection(position: LatLon | null, heading: number | null, manual = false): SelfFeatureCollection {
  if (position === null) return { type: 'FeatureCollection', features: [] };
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        id: 'self',
        geometry: { type: 'Point', coordinates: [position.lon, position.lat] },
        properties: manual
          ? { icon: MAP_IMAGE_IDS.selfManual, heading: 0 }
          : heading === null
            ? { icon: MAP_IMAGE_IDS.selfNoHeading, heading: 0 }
            : { icon: MAP_IMAGE_IDS.self, heading },
      },
    ],
  };
}
