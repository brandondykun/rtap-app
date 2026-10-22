import { toUtm } from '@/lib/geo/coords/utm';

import { eastingsRunSouth, GRID_MAX_LINES, gridStep, mgrsGrid, orientEastings, type GridView } from './mgrs-grid';

const DC = { lat: 38.8977, lon: -77.0365 };

/** A view of about `km` across centred on `at`. */
function around(at: { lat: number; lon: number }, km: number, zoom: number): GridView {
  const dLat = km / 2 / 111;
  const dLon = dLat / Math.cos((at.lat * Math.PI) / 180);
  return { sw: { lat: at.lat - dLat, lon: at.lon - dLon }, ne: { lat: at.lat + dLat, lon: at.lon + dLon }, zoom };
}

const linesOf = (view: GridView, kind?: string) => mgrsGrid(view).lines.features.filter((f) => !kind || f.properties.kind === kind);
const labelsOf = (view: GridView) => mgrsGrid(view).labels.features.map((f) => f.properties.label);

describe('gridStep', () => {
  it.each([
    [2, null],
    [4.9, null],
    [5, 100_000],
    [7.9, 100_000],
    [8, 10_000],
    [11, 1_000],
    [14, 100],
    [20, 100],
  ])('zoom %p → %p m', (zoom, step) => {
    expect(gridStep(zoom)).toBe(step);
  });

  it('stops at 1 km lines when 100 m lines are off', () => {
    expect(gridStep(14, 1_000)).toBe(1_000);
    expect(gridStep(20, 1_000)).toBe(1_000);
    expect(gridStep(9, 1_000)).toBe(10_000);
  });
});

describe('mgrsGrid', () => {
  it('draws 1 km lines on whole kilometres of easting and northing', () => {
    const lines = linesOf(around(DC, 20, 11), 'minor');
    expect(lines.length).toBeGreaterThan(20);
    for (const line of lines) {
      const values = line.geometry.coordinates.map(([lon, lat]) => toUtm({ lat, lon }, 18)[line.properties.axis === 'e' ? 'easting' : 'northing']);
      for (const v of values) expect(Math.abs(v - Math.round(v / 1000) * 1000)).toBeLessThan(0.5);
    }
  });

  it('marks the 100 km lines as major among finer lines', () => {
    const major = linesOf(around({ lat: 38.9, lon: -77.3 }, 60, 9), 'major');
    expect(major.length).toBeGreaterThan(0);
    for (const line of major) {
      const [lon, lat] = line.geometry.coordinates[0];
      const v = toUtm({ lat, lon }, 18)[line.properties.axis === 'e' ? 'easting' : 'northing'];
      // Within a thousandth of the 10 km spacing.
      expect(Math.abs(v - Math.round(v / 100_000) * 100_000)).toBeLessThan(10);
    }
  });

  it('covers the view and half a screen around it', () => {
    const view = around(DC, 10, 12);
    const lons = linesOf(view).flatMap((l) => l.geometry.coordinates.map(([lon]) => lon));
    const width = view.ne.lon - view.sw.lon;
    expect(Math.min(...lons)).toBeLessThan(view.sw.lon - width * 0.4);
    expect(Math.max(...lons)).toBeGreaterThan(view.ne.lon + width * 0.4);
    expect(Math.min(...lons)).toBeGreaterThanOrEqual(view.sw.lon - width * 0.5 - 1e-9);
  });

  it('stops each zone grid at the zone line, which it draws', () => {
    // Zones 17 and 18 meet at 78°W.
    const lines = linesOf(around({ lat: 38.9, lon: -78 }, 20, 11));
    const zone = lines.filter((l) => l.properties.kind === 'zone');
    expect(zone.some((l) => l.geometry.coordinates.every(([lon]) => lon === -78))).toBe(true);
    for (const line of lines.filter((l) => l.properties.kind !== 'zone')) {
      const lons = line.geometry.coordinates.map(([lon]) => lon);
      expect(lons.every((lon) => lon <= -78 + 1e-9) || lons.every((lon) => lon >= -78 - 1e-9)).toBe(true);
    }
  });

  it('labels lines with their kilometres within the 100 km square: two digits for 1 km and 10 km lines', () => {
    // Centred in zone 18, so every line is measured in it.
    for (const [zoom, km] of [
      [11, 20],
      [8, 150],
    ]) {
      for (const line of linesOf(around({ lat: 38.9, lon: -75 }, km, zoom)).filter((l) => l.properties.kind !== 'zone')) {
        const [lon, lat] = line.geometry.coordinates[0];
        const v = toUtm({ lat, lon }, 18)[line.properties.axis === 'e' ? 'easting' : 'northing'];
        expect(line.properties.label).toBe(String(Math.round((v % 100_000) / 1000) % 100).padStart(2, '0'));
      }
    }
  });

  it('draws 1 km lines, labelled in kilometres, instead of 100 m lines when 100 m lines are off', () => {
    const lines = mgrsGrid(around(DC, 2, 15), 1_000).lines.features.filter((f) => f.properties.kind === 'minor');
    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) {
      const [lon, lat] = line.geometry.coordinates[0];
      const v = toUtm({ lat, lon }, 18)[line.properties.axis === 'e' ? 'easting' : 'northing'];
      expect(Math.abs(v - Math.round(v / 1000) * 1000)).toBeLessThan(0.5);
      expect(line.properties.label).toMatch(/^\d{2}$/);
    }
  });

  it('labels 100 m lines with three digits', () => {
    const lines = linesOf(around(DC, 2, 14), 'minor');
    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) expect(line.properties.label).toMatch(/^\d{3}$/);
  });

  it('names the 100 km squares, not the lines, at 100 km spacing', () => {
    const view = around(DC, 400, 6);
    expect(linesOf(view).every((l) => l.properties.label === undefined)).toBe(true);
    expect(labelsOf(view)).toContain('UJ');
  });

  it('draws only the grid zones, named, when zoomed far out', () => {
    const view = { sw: { lat: 25, lon: -100 }, ne: { lat: 50, lon: -60 }, zoom: 3 };
    expect(linesOf(view).every((l) => l.properties.kind === 'zone')).toBe(true);
    expect(labelsOf(view)).toEqual(expect.arrayContaining(['18S', '17R', '14T']));
  });

  it('follows the Norway exception: no zone line at 6°E in band V, one at 3°E', () => {
    const zone = linesOf({ sw: { lat: 52, lon: 0 }, ne: { lat: 68, lon: 15 }, zoom: 4 }, 'zone');
    const at = (lon: number) => zone.filter((l) => l.geometry.coordinates.every(([x]) => x === lon));
    const covers = (lines: typeof zone, lat: number) => lines.some((l) => Math.min(...l.geometry.coordinates.map(([, y]) => y)) <= lat && Math.max(...l.geometry.coordinates.map(([, y]) => y)) >= lat);
    expect(covers(at(6), 60)).toBe(false);
    expect(covers(at(6), 54)).toBe(true);
    expect(covers(at(3), 60)).toBe(true);
    expect(covers(at(3), 54)).toBe(false);
  });

  it('works south of the equator', () => {
    const lines = linesOf(around({ lat: -33.86, lon: 151.21 }, 20, 11), 'minor');
    expect(lines.length).toBeGreaterThan(20);
    for (const line of lines.filter((l) => l.properties.axis === 'n')) {
      const [lon, lat] = line.geometry.coordinates[0];
      const v = toUtm({ lat, lon }, 56).northing;
      expect(Math.abs(v - Math.round(v / 1000) * 1000)).toBeLessThan(0.5);
    }
  });

  it('draws across the antimeridian, in −180…180', () => {
    const lines = linesOf({ sw: { lat: -17, lon: 179.9 }, ne: { lat: -16.9, lon: 180.1 }, zoom: 13 });
    const lons = lines.flatMap((l) => l.geometry.coordinates.map(([lon]) => lon));
    expect(lons.some((lon) => lon > 179)).toBe(true);
    expect(lons.some((lon) => lon < -179)).toBe(true);
    expect(lons.every((lon) => lon >= -180 && lon <= 180)).toBe(true);
  });

  it('coarsens the spacing rather than draw too many lines (a tilted 3D view reaches the horizon)', () => {
    const lines = linesOf({ sw: { lat: 37, lon: -79 }, ne: { lat: 40, lon: -76 }, zoom: 14 }, 'minor');
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.length).toBeLessThanOrEqual(GRID_MAX_LINES);
    expect(lines[0].properties.label).toMatch(/^\d{2}$/);
  });

  it('draws nothing beyond MGRS coverage (north of 84°N)', () => {
    expect(linesOf({ sw: { lat: 85, lon: 0 }, ne: { lat: 85.05, lon: 1 }, zoom: 12 })).toEqual([]);
  });
});

describe('orientEastings', () => {
  const { lines } = mgrsGrid(around(DC, 20, 11));
  const eastings = (fc: typeof lines) => fc.features.filter((f) => f.properties.axis === 'e');
  const southward = (f: (typeof lines)['features'][number]) => f.geometry.coordinates[f.geometry.coordinates.length - 1][1] < f.geometry.coordinates[0][1];

  it('runs easting lines north to south, so their numbers read down the screen with their tops toward higher eastings', () => {
    expect(eastings(lines).length).toBeGreaterThan(0);
    expect(eastings(orientEastings(lines, true)).every(southward)).toBe(true);
  });

  it('runs them south to north when turned around', () => {
    expect(eastings(orientEastings(lines, false)).some(southward)).toBe(false);
  });

  it('leaves the northing lines and zone edges as they are', () => {
    const turned = orientEastings(lines, false);
    lines.features.forEach((f, i) => {
      if (f.properties.axis !== 'e') expect(turned.features[i]).toBe(f);
    });
  });
});

describe('eastingsRunSouth', () => {
  it.each([0, 45, 90, 150, 180, 340, 330])('runs them south at map bearing %p', (bearing) => {
    expect(eastingsRunSouth(bearing)).toBe(true);
  });

  it.each([181, 270, 329, -90])('turns them around at map bearing %p, where they would read upside down', (bearing) => {
    expect(eastingsRunSouth(bearing)).toBe(false);
  });
});
