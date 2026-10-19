import { INITIAL_DRAFT } from '@/stores/draft';

import { minimizedSummary } from './minimized-summary';

const P = { lat: 1, lon: 1 };
const draft = (over: Partial<typeof INITIAL_DRAFT>) => ({ ...INITIAL_DRAFT, ...over });

describe('minimizedSummary', () => {
  it('names a polygon being added and counts its points', () => {
    expect(minimizedSummary('polygon.add', 'Add polygon', draft({ mode: 'add', category: 'polygon', name: 'OBJ-1', vertices: [P, P, P] }))).toEqual({
      label: 'OBJ-1',
      detail: '3 PTS',
      spoken: 'OBJ-1, 3 points',
    });
  });

  it('says CIRCLE for a circle polygon, and counts a line’s points (singular for one)', () => {
    expect(minimizedSummary('polygon.edit', 'Edit polygon', draft({ mode: 'edit', category: 'polygon', name: 'AO', polygonShape: 'circle' })).detail).toBe('CIRCLE');
    expect(minimizedSummary('line.add', 'Add line', draft({ mode: 'add', category: 'line', name: 'PL RED', vertices: [P] }))).toMatchObject({ detail: '1 PT', spoken: 'PL RED, 1 point' });
  });

  it('shows just the name for a unit or point', () => {
    expect(minimizedSummary('unit.add', 'Add unit', draft({ mode: 'add', category: 'unit', name: 'HOS-3' }))).toEqual({ label: 'HOS-3', detail: null, spoken: 'HOS-3' });
  });

  it('falls back to the menu title without a draft name, and for other menus', () => {
    expect(minimizedSummary('unit.add', 'Add unit', draft({ mode: 'add', category: 'unit', name: '  ' })).label).toBe('ADD UNIT');
    expect(minimizedSummary('layers', 'Layers', INITIAL_DRAFT)).toEqual({ label: 'LAYERS', detail: null, spoken: 'Layers' });
  });
});
