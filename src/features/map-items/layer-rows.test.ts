import { composeSidc, DEFAULT_SIDC } from '@/features/symbology/presets';

import { pointGeometry } from './geometry';
import { LAYER_ROW_LIMIT, layerRows } from './layer-rows';
import type { MapItemSnapshot } from './repository';

const at = { lat: 38.9, lon: -77 };

function item(id: string, name: string, sidc: string | null = 'SHGPUCI--------'): MapItemSnapshot {
  return { id, kind: 'point', geometry: pointGeometry(at), sidc, style: null, name, notes: null, updatedAt: 1 };
}

describe('layerRows', () => {
  const items = [item('a', 'HOS-10'), item('b', 'hos-2'), item('c', 'OBJ IRON', 'bogus'), item('d', 'FRD-1')];

  it('sorts by name with numbers in order and marks hidden points', () => {
    const r = layerRows(items, ['b', 'other-mission-item'], '');
    expect(r.rows.map((x) => x.name)).toEqual(['FRD-1', 'hos-2', 'HOS-10', 'OBJ IRON']);
    expect(r.rows.find((x) => x.id === 'b')?.hidden).toBe(true);
    expect(r.hiddenIds).toEqual(['b']);
    expect(r).toMatchObject({ total: 4, matched: 4 });
    expect(r.rows[0].coord).toEqual(at);
  });

  it('searches names in any case', () => {
    const r = layerRows(items, [], '  hos ');
    expect(r.rows.map((x) => x.id)).toEqual(['b', 'a']);
    expect(r.matched).toBe(2);
    expect(r.total).toBe(4);
  });

  it('caps the rows but reports every match', () => {
    const many = Array.from({ length: 250 }, (_, i) => item(`p${i}`, `P-${i + 1}`));
    const r = layerRows(many, [], '', 100);
    expect(r.rows).toHaveLength(100);
    expect(r.matched).toBe(250);
    expect(r.rows[99].name).toBe('P-100');
  });

  it('falls back to the default symbol for unknown SIDCs', () => {
    expect(layerRows(items, [], 'obj').rows[0].sidc).toBe(DEFAULT_SIDC);
  });

  it('counts units and points and searches type labels too', () => {
    const items = [item('a', 'CP-1', 'GFGPGPPK------X'), item('b', 'HOS-1', composeSidc('hostile', 'infantry')), item('c', 'BRAVO', null)];
    expect(layerRows(items, [], '')).toMatchObject({ units: 2, points: 1, total: 3 });
    expect(layerRows(items, [], 'checkpoint').rows.map((r) => r.id)).toEqual(['a']);
    expect(layerRows(items, [], 'infantry').rows.map((r) => r.id)).toEqual(['b']);
    expect(layerRows(items, [], 'brav').rows.map((r) => r.id)).toEqual(['c']);
  });


  it('lists lines with their type and length, counts them, and searches their type', () => {
    const lineItem = {
      ...item('l', 'RED', null),
      kind: 'line' as const,
      style: '{"lineType":"phase-line"}',
      geometry: JSON.stringify({ type: 'LineString', coordinates: [[-77, 38.9], [-77, 38.91]] }),
    };
    const rows = layerRows([item('a', 'CP-1', 'GFGPGPPK------X'), lineItem], [], '');
    expect(rows).toMatchObject({ units: 0, points: 1, lines: 1, total: 2 });
    const line = rows.rows.find((r) => r.id === 'l')!;
    expect(line).toMatchObject({ kind: 'line', lineType: 'phase-line', coord: null });
    expect(line.length).toBeGreaterThan(1000);
    expect(layerRows([lineItem], [], 'phase').rows.map((r) => r.id)).toEqual(['l']);
  });

  it('lists polygons with type and area or radius, counts them, and searches their type', () => {
    const tri = JSON.stringify({ type: 'Polygon', coordinates: [[[-77, 38.9], [-76.99, 38.9], [-76.99, 38.91], [-77, 38.9]]] });
    const area = { ...item('a', 'IRON', null), kind: 'polygon' as const, style: '{"polygonType":"objective","shape":"points"}', geometry: tri };
    const circle = { ...item('c', '1', null), kind: 'polygon' as const, style: '{"polygonType":"no-fire-area","shape":"circle","center":{"lat":38.9,"lon":-77},"radiusM":500}', geometry: tri };
    const rows = layerRows([area, circle], [], '');
    expect(rows).toMatchObject({ units: 0, points: 0, lines: 0, polygons: 2, total: 2 });
    expect(rows.rows.find((r) => r.id === 'a')).toMatchObject({ kind: 'polygon', polygonType: 'objective', radiusM: null, coord: null });
    expect(rows.rows.find((r) => r.id === 'a')!.areaM2).toBeGreaterThan(0);
    expect(rows.rows.find((r) => r.id === 'c')).toMatchObject({ polygonType: 'no-fire-area', radiusM: 500 });
    expect(layerRows([area, circle], [], 'no fire').rows.map((r) => r.id)).toEqual(['c']);
  });

  it('narrows rows, totals and hidden ids to one category while keeping every count', () => {
    const line = {
      ...item('l', 'RED', null),
      kind: 'line' as const,
      style: '{"lineType":"phase-line"}',
      geometry: JSON.stringify({ type: 'LineString', coordinates: [[-77, 38.9], [-77, 38.91]] }),
    };
    const all = [item('a', 'HOS-1', composeSidc('hostile', 'infantry')), item('b', 'CP-1', 'GFGPGPPK------X'), line];
    const r = layerRows(all, ['a', 'l'], '', LAYER_ROW_LIMIT, 'line');
    expect(r.rows.map((x) => x.id)).toEqual(['l']);
    expect(r).toMatchObject({ total: 1, matched: 1, hiddenIds: ['l'], units: 1, points: 1, lines: 1, polygons: 0 });
    expect(layerRows(all, [], 'hos', LAYER_ROW_LIMIT, 'point').rows).toEqual([]);
  });
});
