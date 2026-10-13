import { composeSidc, DEFAULT_SIDC } from '@/features/symbology/presets';

import { pointGeometry } from './geometry';
import { layerRows } from './layer-rows';
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
});
