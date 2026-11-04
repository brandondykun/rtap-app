import type { LatLon } from '@/lib/geo/types';

import { MAP_IMAGE_IDS } from '../images/map-images';

type SelfIcon = (typeof MAP_IMAGE_IDS)['self' | 'selfNoHeading' | 'selfManual' | 'selfAveraged' | 'selfAveragedNoHeading'];

export type SelfFeatureCollection = {
  type: 'FeatureCollection';
  features: {
    type: 'Feature';
    id: 'self';
    geometry: { type: 'Point'; coordinates: [number, number] };
    properties: { icon: SelfIcon; heading: number };
  }[];
};

/**
 * One feature for the self icon; the no-heading and manual icons have no arrow or cone to rotate. An averaged position
 * (Average mode, held too) gets the orange arrow or dot.
 */
export function selfFeatureCollection(position: LatLon | null, heading: number | null, manual = false, averaged = false): SelfFeatureCollection {
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
            ? { icon: averaged ? MAP_IMAGE_IDS.selfAveragedNoHeading : MAP_IMAGE_IDS.selfNoHeading, heading: 0 }
            : { icon: averaged ? MAP_IMAGE_IDS.selfAveraged : MAP_IMAGE_IDS.self, heading },
      },
    ],
  };
}
