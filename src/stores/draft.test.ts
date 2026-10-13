import { INITIAL_DRAFT, useDraft } from './draft';

const A = { lat: 38.9, lon: -77 };
const B = { lat: 38.95, lon: -77.05 };

beforeEach(() => useDraft.setState(INITIAL_DRAFT));

describe('draft store', () => {
  it('starts an add at a coordinate with the remembered affiliation', () => {
    useDraft.getState().startAdd({ coord: A, source: 'crosshair' });
    expect(useDraft.getState()).toMatchObject({ mode: 'add', coord: A, coordSource: 'crosshair', affiliation: 'hostile', name: '', nameEdited: false });
  });

  it('bumps the revision on every coordinate change and ignores invalid ones', () => {
    useDraft.getState().startAdd({ coord: A, source: 'crosshair' });
    const rev = useDraft.getState().coordRev;
    useDraft.getState().setCoord(B, 'typed');
    expect(useDraft.getState()).toMatchObject({ coord: B, coordSource: 'typed', coordRev: rev + 1 });
    useDraft.getState().setCoord({ lat: 95, lon: 0 }, 'press');
    expect(useDraft.getState()).toMatchObject({ coord: B, coordRev: rev + 1 });
  });

  it('clears an auto name when the affiliation changes, but keeps an edited one', () => {
    useDraft.getState().startAdd({ coord: A, source: 'crosshair' });
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
    useDraft.getState().startAdd({ coord: A, source: 'crosshair' });
    useDraft.getState().setName('X');
    useDraft.getState().setName('  ');
    expect(useDraft.getState().nameEdited).toBe(false);
  });

  it('remembers add choices across clear, but not edit values', () => {
    useDraft.getState().startAdd({ coord: A, source: 'crosshair' });
    useDraft.getState().setAffiliation('friend');
    useDraft.getState().clear();
    useDraft.getState().startEdit({ itemId: 'i1', coord: B, affiliation: 'unknown', unitType: 'medical', name: 'UNK-1', notes: '' });
    expect(useDraft.getState()).toMatchObject({ mode: 'edit', itemId: 'i1', nameEdited: true, coordSource: 'item' });
    useDraft.getState().clear();
    expect(useDraft.getState()).toMatchObject({ mode: null, coord: null, affiliation: 'friend' });
    useDraft.getState().startAdd({ coord: A, source: 'press' });
    expect(useDraft.getState().affiliation).toBe('friend');
  });

  it('picks a map location once, and never while locked', () => {
    useDraft.getState().setPicking(true);
    expect(useDraft.getState().picking).toBe(false); // no draft yet
    useDraft.getState().startAdd({ coord: A, source: 'crosshair' });
    useDraft.getState().setPicking(true);
    expect(useDraft.getState().picking).toBe(true);
    useDraft.getState().setCoord(B, 'press');
    expect(useDraft.getState()).toMatchObject({ coord: B, picking: false });
    useDraft.getState().startEdit({ itemId: 'i1', coord: A, affiliation: 'friend', unitType: 'armor', name: 'FRD-1', notes: '' });
    useDraft.getState().setPicking(true);
    expect(useDraft.getState().picking).toBe(false);
  });
});
