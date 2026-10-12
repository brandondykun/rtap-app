import Storage from 'expo-sqlite/kv-store';

import { DEFAULT_SETTINGS, useSettings } from './settings';

beforeEach(() => {
  useSettings.setState(DEFAULT_SETTINGS);
});

describe('settings store', () => {
  it('defaults to MGRS, degrees, grid north, no override', () => {
    const s = useSettings.getState();
    expect(s.coordinateFormat).toBe('mgrs');
    expect(s.angleUnit).toBe('deg');
    expect(s.northRef).toBe('grid');
    expect(s.declinationOverrideDeg).toBeNull();
  });

  it('toggles grid ↔ magnetic', () => {
    useSettings.getState().toggleGridMagnetic();
    expect(useSettings.getState().northRef).toBe('magnetic');
    useSettings.getState().toggleGridMagnetic();
    expect(useSettings.getState().northRef).toBe('grid');
  });

  it('toggles from true north to grid', () => {
    useSettings.getState().setNorthRef('true');
    useSettings.getState().toggleGridMagnetic();
    expect(useSettings.getState().northRef).toBe('grid');
  });

  it('accepts a declination override within ±180°', () => {
    expect(useSettings.getState().setDeclinationOverride(-10.5)).toBe(true);
    expect(useSettings.getState().declinationOverrideDeg).toBe(-10.5);
    expect(useSettings.getState().setDeclinationOverride(null)).toBe(true);
    expect(useSettings.getState().declinationOverrideDeg).toBeNull();
  });

  it.each([Number.NaN, 181, -200, Number.POSITIVE_INFINITY])('rejects override %p', (deg) => {
    expect(useSettings.getState().setDeclinationOverride(deg)).toBe(false);
    expect(useSettings.getState().declinationOverrideDeg).toBeNull();
  });

  it('persists to the kv store', async () => {
    useSettings.getState().setAngleUnit('mil');
    await new Promise((r) => setTimeout(r, 0));
    const raw = await Storage.getItem('settings');
    expect(JSON.parse(raw ?? '{}').state.angleUnit).toBe('mil');
  });
});
