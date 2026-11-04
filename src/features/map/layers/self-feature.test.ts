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

  it('draws an averaged position with the orange icons, keeping the heading', () => {
    const at = { lat: 38.9, lon: -77 };
    expect(selfFeatureCollection(at, 90, false, true).features[0].properties).toEqual({ icon: MAP_IMAGE_IDS.selfAveraged, heading: 90 });
    expect(selfFeatureCollection(at, null, false, true).features[0].properties).toEqual({ icon: MAP_IMAGE_IDS.selfAveragedNoHeading, heading: 0 });
  });

  it('draws a manual position with its own icon and no heading, even if a heading is known', () => {
    const [f] = selfFeatureCollection({ lat: 1, lon: 2 }, 90, true).features;
    expect(f.properties).toEqual({ icon: MAP_IMAGE_IDS.selfManual, heading: 0 });
  });
});
