import { INITIAL_MANUAL_ENTRY, useManualEntry } from './manual-entry';

const s = useManualEntry.getState;

beforeEach(() => useManualEntry.setState(INITIAL_MANUAL_ENTRY));

describe('manual-entry store', () => {
  it('starts closed', () => {
    expect(s()).toMatchObject({ phase: 'closed', origin: 'map', start: null, chosen: null, pending: null });
  });

  it('opens, chooses on the map, comes back with the spot, and cancels without losing it', () => {
    s().open('map', null);
    s().startChoosing();
    expect(s().phase).toBe('choosing');
    s().choose({ lat: 1, lon: 2 });
    expect(s()).toMatchObject({ phase: 'entry', chosen: { lat: 1, lon: 2 } });
    s().startChoosing();
    s().cancelChoosing();
    expect(s()).toMatchObject({ phase: 'entry', chosen: { lat: 1, lon: 2 } });
  });

  it('opens from Settings with the saved position to start from', () => {
    s().open('settings', { lat: 3, lon: 4 });
    expect(s()).toMatchObject({ phase: 'entry', origin: 'settings', start: { lat: 3, lon: 4 }, chosen: null });
  });

  it('only starts or cancels choosing from the right phase', () => {
    s().startChoosing();
    expect(s().phase).toBe('closed');
    s().open('map', null);
    s().cancelChoosing();
    expect(s().phase).toBe('entry');
  });

  it('closes back to the start, dropping the pending spot', () => {
    s().open('map', null);
    s().setPending({ lat: 1, lon: 2 });
    expect(s().pending).toEqual({ lat: 1, lon: 2 });
    s().close();
    expect(s()).toMatchObject(INITIAL_MANUAL_ENTRY);
  });
});
