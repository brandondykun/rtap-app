import { filterMissions, formatMissionTotals, mgrsSquare, pinnedMission, sortHeading, sortMissions } from './mission-list';
import type { CategoryCounts, MissionSummary } from './repository';

const m = (id: string, name: string, lastOpenedAt: number | null): MissionSummary => ({ id, name, createdAt: 0, lastOpenedAt, camera: null, snapshot: null });
const c = (units: number, points = 0, lines = 0, polygons = 0): CategoryCounts => ({ units, points, lines, polygons });

const alpha = m('a', 'alpha', 100);
const bravo = m('b', 'Bravo', 300);
const charlie = m('c', 'charlie', null);
const delta = m('d', 'Delta', null);
const list = [alpha, bravo, charlie, delta];
const counts = new Map([
  ['a', c(5)],
  ['b', c(1, 1)],
  ['c', c(5)],
  ['d', c(0)],
]);
const ids = (l: MissionSummary[]) => l.map((x) => x.id);

describe('sortMissions', () => {
  it('Recent: last opened first, never opened last by name', () => {
    expect(ids(sortMissions(list, 'recent', counts))).toEqual(['b', 'a', 'c', 'd']);
  });
  it('Name: case-insensitive A to Z', () => {
    expect(ids(sortMissions(list, 'name', counts))).toEqual(['a', 'b', 'c', 'd']);
  });
  it('Most items: total descending, ties by Recent', () => {
    expect(ids(sortMissions(list, 'most', counts))).toEqual(['a', 'c', 'b', 'd']);
  });
  it('treats missing counts as zero', () => {
    expect(ids(sortMissions([delta, alpha], 'most', new Map()))).toEqual(['a', 'd']);
  });
});

describe('filterMissions', () => {
  it('matches names case-insensitively and ignores surrounding space', () => {
    expect(ids(filterMissions(list, '  BRA '))).toEqual(['b']);
  });
  it('lists every mission for a blank or whitespace query', () => {
    expect(filterMissions(list, '   ')).toHaveLength(4);
  });
});

describe('pinnedMission', () => {
  it('is the most recently opened, or null when none was opened', () => {
    expect(pinnedMission(list)?.id).toBe('b');
    expect(pinnedMission([charlie, delta])).toBeNull();
  });
});

describe('labels', () => {
  it('mgrsSquare gives zone, band and 100 km square', () => {
    expect(mgrsSquare({ lat: 38.8977, lon: -77.0365 })).toBe('18S UJ');
    expect(mgrsSquare({ lat: 89, lon: 0 })).toBeNull();
  });
  it('formatMissionTotals uses singular forms for one', () => {
    expect(formatMissionTotals(3, 43)).toBe('3 missions · 43 units plotted');
    expect(formatMissionTotals(1, 1)).toBe('1 mission · 1 unit plotted');
  });
  it('sortHeading names the list under the pinned card', () => {
    expect([sortHeading('recent'), sortHeading('name'), sortHeading('most')]).toEqual(['EARLIER', 'BY NAME', 'MOST ITEMS']);
  });
});
