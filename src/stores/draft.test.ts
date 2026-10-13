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
});
