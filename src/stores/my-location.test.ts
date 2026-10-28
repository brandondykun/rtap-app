import Storage from 'expo-sqlite/kv-store';

import { DEFAULT_MY_LOCATION, useMyLocation } from './my-location';

const stored = () => JSON.parse(Storage.getItemSync('my-location') ?? '{}').state;

beforeEach(() => {
  useMyLocation.setState(DEFAULT_MY_LOCATION);
});

describe('my-location store', () => {
  it('starts on GPS with no manual position and the notice not yet closed', () => {
    expect(useMyLocation.getState()).toMatchObject({ source: 'gps', manual: null, offNoticeClosed: false });
  });

  it('setting a position by hand switches to Manual and remembers it', () => {
    expect(useMyLocation.getState().setManual({ lat: 38.9, lon: -77 })).toBe(true);
    expect(stored()).toMatchObject({ source: 'manual', manual: { lat: 38.9, lon: -77 } });
  });

  it('rejects an impossible position and changes nothing', () => {
    expect(useMyLocation.getState().setManual({ lat: 91, lon: 0 })).toBe(false);
    expect(useMyLocation.getState().setManual({ lat: NaN, lon: 0 })).toBe(false);
    expect(useMyLocation.getState()).toMatchObject({ source: 'gps', manual: null });
  });

  it('switching to GPS clears the manual position; switching back starts unset', () => {
    useMyLocation.getState().setManual({ lat: 38.9, lon: -77 });
    useMyLocation.getState().switchToGps();
    expect(useMyLocation.getState()).toMatchObject({ source: 'gps', manual: null });
    useMyLocation.getState().switchToManual();
    expect(useMyLocation.getState()).toMatchObject({ source: 'manual', manual: null });
  });

  it('remembers that the location-off notice was closed', () => {
    useMyLocation.getState().closeOffNotice();
    expect(stored()).toMatchObject({ offNoticeClosed: true });
  });

  it('ignores stored values that are not valid', async () => {
    Storage.setItemSync('my-location', JSON.stringify({ state: { source: 'radio', manual: { lat: 'x', lon: 200 }, offNoticeClosed: 'yes' }, version: 1 }));
    await useMyLocation.persist.rehydrate();
    expect(useMyLocation.getState()).toMatchObject(DEFAULT_MY_LOCATION);
  });

  it('keeps a stored Manual source with no position (unset after a restart)', async () => {
    Storage.setItemSync('my-location', JSON.stringify({ state: { source: 'manual', manual: null, offNoticeClosed: false }, version: 1 }));
    await useMyLocation.persist.rehydrate();
    expect(useMyLocation.getState()).toMatchObject({ source: 'manual', manual: null });
  });
});
