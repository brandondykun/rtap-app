import { INITIAL_DRAFT, useDraft } from './draft';

const A = { lat: 38.9, lon: -77 };
const B = { lat: 38.95, lon: -77.05 };

beforeEach(() => useDraft.setState(INITIAL_DRAFT));

describe('draft store', () => {
  it('starts an add at a coordinate with the remembered affiliation', () => {
    useDraft.getState().startAdd({ coord: A, source: 'crosshair', category: 'unit' });
    expect(useDraft.getState()).toMatchObject({ mode: 'add', coord: A, coordSource: 'crosshair', affiliation: 'hostile', name: '', nameEdited: false });
  });

  it('bumps the revision on every coordinate change and ignores invalid ones', () => {
    useDraft.getState().startAdd({ coord: A, source: 'crosshair', category: 'unit' });
    const rev = useDraft.getState().coordRev;
    useDraft.getState().setCoord(B, 'typed');
    expect(useDraft.getState()).toMatchObject({ coord: B, coordSource: 'typed', coordRev: rev + 1 });
    useDraft.getState().setCoord({ lat: 95, lon: 0 }, 'press');
    expect(useDraft.getState()).toMatchObject({ coord: B, coordRev: rev + 1 });
  });

  it('clears an auto name when the affiliation changes, but keeps an edited one', () => {
    useDraft.getState().startAdd({ coord: A, source: 'crosshair', category: 'unit' });
    useDraft.getState().setAutoName('HOS-1');
    useDraft.getState().setAffiliation('friend');
    expect(useDraft.getState().name).toBe('');
    useDraft.getState().setName('OBJ IRON');
    useDraft.getState().setAffiliation('neutral');
    expect(useDraft.getState().name).toBe('OBJ IRON');
    useDraft.getState().setAutoName('NEU-1');
    expect(useDraft.getState().name).toBe('OBJ IRON');
  });

  it('returns to auto naming when the user clears the name', () => {
    useDraft.getState().startAdd({ coord: A, source: 'crosshair', category: 'unit' });
    useDraft.getState().setName('X');
    useDraft.getState().setName('  ');
    expect(useDraft.getState().nameEdited).toBe(false);
  });

  it('remembers add choices across clear, but not edit values', () => {
    useDraft.getState().startAdd({ coord: A, source: 'crosshair', category: 'unit' });
    useDraft.getState().setAffiliation('friend');
    useDraft.getState().clear();
    useDraft.getState().startEdit({ itemId: 'i1', coord: B, category: 'unit', pointType: 'checkpoint', affiliation: 'unknown', unitType: 'medical', name: 'UNK-1', notes: '' });
    expect(useDraft.getState()).toMatchObject({ mode: 'edit', itemId: 'i1', nameEdited: true, coordSource: 'item' });
    useDraft.getState().clear();
    expect(useDraft.getState()).toMatchObject({ mode: null, coord: null, affiliation: 'friend' });
    useDraft.getState().startAdd({ coord: A, source: 'press', category: 'unit' });
    expect(useDraft.getState().affiliation).toBe('friend');
  });

  it('picks a map location once, and never while locked', () => {
    useDraft.getState().setPicking(true);
    expect(useDraft.getState().picking).toBe(false); // no draft yet
    useDraft.getState().startAdd({ coord: A, source: 'crosshair', category: 'unit' });
    useDraft.getState().setPicking(true);
    expect(useDraft.getState().picking).toBe(true);
    useDraft.getState().setCoord(B, 'press');
    expect(useDraft.getState()).toMatchObject({ coord: B, picking: false });
    useDraft.getState().startEdit({ itemId: 'i1', coord: A, category: 'unit', pointType: 'checkpoint', affiliation: 'friend', unitType: 'armor', name: 'FRD-1', notes: '' });
    useDraft.getState().setPicking(true);
    expect(useDraft.getState().picking).toBe(false);
  });
});

describe('categories', () => {
  beforeEach(() => useDraft.setState(INITIAL_DRAFT));

  it('starts a point add with the remembered type and records the last Add', () => {
    useDraft.getState().startAdd({ coord: A, source: 'crosshair', category: 'point' });
    expect(useDraft.getState()).toMatchObject({ category: 'point', pointType: 'checkpoint', lastAddCategory: 'point' });
    useDraft.getState().setPointType('landing-zone');
    useDraft.getState().clear();
    expect(useDraft.getState().lastAddCategory).toBe('point');
    useDraft.getState().startAdd({ coord: A, source: 'crosshair', category: 'point' });
    expect(useDraft.getState().pointType).toBe('landing-zone');
  });

  it('renames an auto-named draft on type change but keeps a typed name', () => {
    useDraft.getState().startAdd({ coord: A, source: 'crosshair', category: 'point' });
    useDraft.getState().setAutoName('CP-1');
    useDraft.getState().setPointType('observation-post');
    expect(useDraft.getState().name).toBe('');
    useDraft.getState().setName('OP NORTH');
    useDraft.getState().setPointType('rally-point');
    expect(useDraft.getState().name).toBe('OP NORTH');
  });

  it('does not remember a point type changed while editing', () => {
    useDraft.getState().startEdit({ itemId: 'a', coord: A, category: 'point', pointType: 'checkpoint', affiliation: 'unknown', unitType: 'unspecified', name: 'CP-1', notes: '' });
    useDraft.getState().setLocked(false);
    useDraft.getState().setPointType('start-point');
    expect(useDraft.getState().remembered.pointType).toBe('checkpoint');
  });
});

describe('line drafts', () => {
  const p = (n: number) => ({ lat: 38.9 + n / 100, lon: -77 });
  beforeEach(() => useDraft.setState(INITIAL_DRAFT));

  it('starts an empty line add and undoes each kind of change exactly', () => {
    const d = () => useDraft.getState();
    d().startAddLine();
    expect(d()).toMatchObject({ mode: 'add', category: 'line', vertices: [], lineType: 'phase-line', locked: false });
    d().addVertex(p(1));
    d().addVertex(p(2));
    d().addVertex(p(3));
    d().selectVertex(0);
    d().startInsertAfter(0);
    d().addVertex(p(9));
    expect(d().vertices).toEqual([p(1), p(9), p(2), p(3)]);
    d().undo();
    expect(d()).toMatchObject({ vertices: [p(1), p(2), p(3)], selectedVertex: 0 });
    d().removeVertex(1);
    d().undo();
    expect(d().vertices).toEqual([p(1), p(2), p(3)]);
    d().moveVertex(2, p(7));
    d().undo();
    expect(d().vertices[2]).toEqual(p(3));
  });

  it('caps history and does not record type changes or selection', () => {
    const d = () => useDraft.getState();
    d().startAddLine();
    for (let i = 0; i < 60; i++) d().addVertex(p(i));
    expect(d().history).toHaveLength(50);
    const before = d().history.length;
    d().setLineType('route');
    d().selectVertex(3);
    expect(d().history).toHaveLength(before);
  });

  it('opens a saved line locked with its points', () => {
    useDraft.getState().startEditLine({ itemId: 'l1', points: [p(1), p(2)], lineType: 'boundary', name: 'NORTH', notes: '' });
    expect(useDraft.getState()).toMatchObject({ mode: 'edit', category: 'line', itemId: 'l1', locked: true, vertices: [p(1), p(2)], lineType: 'boundary', history: [] });
  });

  it('frames a saved line for the camera', () => {
    const rev = useDraft.getState().focusRev;
    useDraft.getState().startEditLine({ itemId: 'l', points: [{ lat: 38.9, lon: -77 }, { lat: 39.0, lon: -76.9 }], lineType: 'phase-line', name: 'R', notes: '' });
    const { focusBounds, focusRev } = useDraft.getState();
    expect(focusRev).toBe(rev + 1);
    expect(focusBounds!.sw.lat).toBeLessThan(38.9);
    expect(focusBounds!.ne.lon).toBeGreaterThan(-76.9);
  });
});

describe('polygon drafts', () => {
  const p = (n: number) => ({ lat: 38.9 + n / 100, lon: -77 });
  beforeEach(() => useDraft.setState(INITIAL_DRAFT));
  const d = () => useDraft.getState();

  it('starts a points polygon, keeps 3 points at minimum, and keeps both shapes while switching', () => {
    d().startAddPolygon();
    expect(d()).toMatchObject({ mode: 'add', category: 'polygon', polygonType: 'objective', polygonShape: 'points', coord: null, locked: false });
    for (const n of [0, 1, 2]) d().addVertex(p(n));
    d().removeVertex(0);
    expect(d().vertices).toHaveLength(3);
    d().setPolygonShape('circle');
    d().setCoord(p(5), 'press');
    d().setCircleEdge({ lat: 38.95 + 0.0045, lon: -77 });
    expect(d().circleRadiusM).toBeCloseTo(500, -1);
    d().setPolygonShape('points');
    expect(d().vertices).toHaveLength(3);
    expect(d().coord).toEqual(p(5));
  });

  it('accepts only sensible radii and no edge before a center', () => {
    d().startAddPolygon();
    d().setPolygonShape('circle');
    d().setCircleEdge(p(1));
    expect(d().circleRadiusM).toBeNull();
    d().setCircleRadius(-5);
    expect(d().circleRadiusM).toBeNull();
    d().setCircleRadius(1500);
    expect(d().circleRadiusM).toBe(1500);
    d().setCircleRadius(Number.NaN);
    expect(d().circleRadiusM).toBeNull();
  });

  it('opens a saved circle locked with its exact center and radius, and frames it', () => {
    const rev = d().focusRev;
    d().startEditPolygon({ itemId: 'c', polygonType: 'no-fire-area', shape: { kind: 'circle', center: p(1), radiusM: 500 }, ring: [p(0), p(1), p(2)], name: '1', notes: '' });
    expect(d()).toMatchObject({ mode: 'edit', category: 'polygon', polygonShape: 'circle', coord: p(1), circleRadiusM: 500, locked: true, polygonType: 'no-fire-area' });
    expect(d().focusRev).toBe(rev + 1);
  });

  it('remembers the type used last for the next Add polygon', () => {
    d().startAddPolygon();
    d().setPolygonType('engagement-area');
    d().clear();
    d().startAddPolygon();
    expect(d().polygonType).toBe('engagement-area');
  });
});
