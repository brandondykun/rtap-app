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
    expect(s.basemap).toBe('satellite');
  });

  it('defaults the missions sort to Recent and remembers a change', () => {
    expect(useSettings.getState().missionSort).toBe('recent');
    useSettings.getState().setMissionSort('most');
    expect(useSettings.getState().missionSort).toBe('most');
  });

  it('sets and persists the basemap', () => {
    useSettings.getState().setBasemap('topo');
    expect(useSettings.getState().basemap).toBe('topo');
    expect(JSON.parse(Storage.getItemSync('settings') ?? '{}').state.basemap).toBe('topo');
  });

  it('sets and persists the altitude unit (meters by default)', () => {
    expect(useSettings.getState().altitudeUnit).toBe('m');
    useSettings.getState().setAltitudeUnit('ft');
    expect(useSettings.getState().altitudeUnit).toBe('ft');
    expect(JSON.parse(Storage.getItemSync('settings') ?? '{}').state).toMatchObject({ altitudeUnit: 'ft' });
  });

  it('sets and persists the zoom buttons (shown by default)', () => {
    expect(useSettings.getState().showZoomButtons).toBe(true);
    useSettings.getState().setShowZoomButtons(false);
    expect(useSettings.getState().showZoomButtons).toBe(false);
    expect(JSON.parse(Storage.getItemSync('settings') ?? '{}').state).toMatchObject({ showZoomButtons: false });
  });

  it('sets and persists the center grid (shown by default)', () => {
    expect(useSettings.getState().showCenterGrid).toBe(true);
    useSettings.getState().setShowCenterGrid(false);
    expect(useSettings.getState().showCenterGrid).toBe(false);
    expect(JSON.parse(Storage.getItemSync('settings') ?? '{}').state).toMatchObject({ showCenterGrid: false });
  });

  it('sets and persists the toolbar text (shown by default)', () => {
    expect(useSettings.getState().showToolbarText).toBe(true);
    useSettings.getState().setShowToolbarText(false);
    expect(useSettings.getState().showToolbarText).toBe(false);
    expect(JSON.parse(Storage.getItemSync('settings') ?? '{}').state).toMatchObject({ showToolbarText: false });
  });

  it('toggles and persists the map labels (shown by default)', () => {
    expect(useSettings.getState().showMapLabels).toBe(true);
    useSettings.getState().toggleMapLabels();
    expect(useSettings.getState().showMapLabels).toBe(false);
    expect(JSON.parse(Storage.getItemSync('settings') ?? '{}').state).toMatchObject({ showMapLabels: false });
    useSettings.getState().toggleMapLabels();
    expect(useSettings.getState().showMapLabels).toBe(true);
  });

  it('sets and persists the label text size (medium by default)', () => {
    expect(useSettings.getState().labelSize).toBe('medium');
    useSettings.getState().setLabelSize('large');
    expect(useSettings.getState().labelSize).toBe('large');
    expect(JSON.parse(Storage.getItemSync('settings') ?? '{}').state).toMatchObject({ labelSize: 'large' });
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

  it('persists to the kv store', () => {
    useSettings.getState().setAngleUnit('mil');
    const raw = Storage.getItemSync('settings');
    expect(JSON.parse(raw ?? '{}').state.angleUnit).toBe('mil');
  });

  describe('hydration', () => {
    const seed = (state: unknown) => Storage.setItemSync('settings', JSON.stringify({ state, version: 1 }));

    it('loads valid persisted values, including ±180 declination, and drops the old GPS toggle', async () => {
      seed({ coordinateFormat: 'latlon', angleUnit: 'mil', northRef: 'magnetic', declinationOverrideDeg: 180, basemap: 'dark', showGps: true, altitudeUnit: 'ft' });
      await useSettings.persist.rehydrate();
      expect(useSettings.getState()).not.toHaveProperty('showGps');
      expect(useSettings.getState()).toMatchObject({
        altitudeUnit: 'ft',
        coordinateFormat: 'latlon',
        angleUnit: 'mil',
        northRef: 'magnetic',
        declinationOverrideDeg: 180,
        basemap: 'dark',
      });
      seed({ declinationOverrideDeg: -180 });
      await useSettings.persist.rehydrate();
      expect(useSettings.getState().declinationOverrideDeg).toBe(-180);
    });

    it('falls back per field for corrupt values', async () => {
      seed({ coordinateFormat: 'utm', angleUnit: 'mil', northRef: 42, declinationOverrideDeg: 181, basemap: 'streets', showGps: 'yes', altitudeUnit: 'yd' });
      await useSettings.persist.rehydrate();
      expect(useSettings.getState()).toMatchObject({
        altitudeUnit: 'm',
        coordinateFormat: 'mgrs',
        angleUnit: 'mil',
        northRef: 'grid',
        declinationOverrideDeg: null,
        basemap: 'satellite',
      });
    });

    it('survives unparseable JSON', async () => {
      Storage.setItemSync('settings', '{not json');
      await useSettings.persist.rehydrate();
      expect(useSettings.getState().coordinateFormat).toBe('mgrs');
    });
  });


  it('shows line distances by default, and toggles and persists them', () => {
    expect(useSettings.getState().showLineDistances).toBe(true);
    useSettings.getState().setShowLineDistances(false);
    expect(useSettings.getState().showLineDistances).toBe(false);
    expect(JSON.parse(Storage.getItemSync('settings') ?? '{}').state.showLineDistances).toBe(false);
  });
});
