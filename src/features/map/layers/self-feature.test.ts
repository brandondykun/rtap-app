import { MAP_IMAGE_IDS } from '../images/map-images';
import { selfFeatureCollection } from './self-feature';

describe('selfFeatureCollection', () => {
  it('is empty without a fix', () => {
    expect(selfFeatureCollection(null, 90).features).toEqual([]);
  });

  it('uses the heading icon and rotation when heading is known', () => {
    const [f] = selfFeatureCollection({ lat: 38.9, lon: -77 }, 90).features;
    expect(f.geometry.coordinates).toEqual([-77, 38.9]);
    expect(f.properties).toEqual({ icon: MAP_IMAGE_IDS.self, heading: 90 });
  });

  it('never fakes a north arrow when heading is unknown', () => {
    const [f] = selfFeatureCollection({ lat: 38.9, lon: -77 }, null).features;
    expect(f.properties).toEqual({ icon: MAP_IMAGE_IDS.selfNoHeading, heading: 0 });
  });
});
