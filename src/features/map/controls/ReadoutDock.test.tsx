import { act, fireEvent, screen, within } from '@testing-library/react-native';

import { describeReadout, formatCoordinate } from '@/features/map/interaction/readout';
import { INITIAL_GPS_AVERAGE, useGpsAverage } from '@/stores/gps-average';
import { INITIAL_INTERACTION, useInteraction } from '@/stores/interaction';
import { DEFAULT_MY_LOCATION, useMyLocation } from '@/stores/my-location';
import { INITIAL_OP, useOp } from '@/stores/op';
import { INITIAL_PRESENCE, usePresence } from '@/stores/presence';
import { DEFAULT_SETTINGS, useSettings } from '@/stores/settings';
import { renderWithProviders } from '@/test-utils/render';
import { themeColors } from '@/theme/tokens';

import { ReadoutDock } from './ReadoutDock';

const DC = { lat: 38.8977, lon: -77.0365 };
const CENTER = { lat: 38.905, lon: -77.03 };
const HIDDEN = { includeHiddenElements: true };
/** The dark copies drawn under a text to outline it. */
const edgesOf = (text: string) => screen.queryAllByTestId('text-outline', HIDDEN).filter((c) => c.props.children === text);
const PROPS = { following: false, disabled: false, onRecenter: () => {}, onSetLocation: () => {} };

const fix = (altitudeM: number | null) => usePresence.getState().setSelfPosition({ position: DC, accuracyM: 4.6, timestamp: 1, altitudeM });

beforeEach(() => {
  useInteraction.setState(INITIAL_INTERACTION);
  usePresence.setState(INITIAL_PRESENCE);
  useSettings.setState(DEFAULT_SETTINGS);
  useOp.setState(INITIAL_OP);
  useMyLocation.setState(DEFAULT_MY_LOCATION);
  useGpsAverage.setState(INITIAL_GPS_AVERAGE);
});

describe('ReadoutDock', () => {
  it('puts CTR (the crosshair grid, distance over bearing from you) over ME (your grid, altitude over accuracy)', async () => {
    useInteraction.getState().setCamera({ center: CENTER, zoom: 12, bearing: 0 });
    fix(142.4);
    await renderWithProviders(<ReadoutDock {...PROPS} showCenter />);
    const rows = (screen.getByTestId('readout-dock').children as { props: { testID?: string } }[]).map((c) => c.props.testID);
    expect(rows).toEqual(['dock-center', 'dock-divider', 'dock-self']);
    // The separator follows the Panel background (see-through white), not a fixed dark border.
    expect(screen.getByTestId('dock-divider').props.className).toContain('bg-divider');
    // A little in from the screen edges, more than the buttons above it.
    expect(screen.getByTestId('readout-dock').props.className).toContain('mx-2');
    expect(screen.getByTestId('dock-self')).toHaveTextContent(/ME.*18S UJ \d{5} \d{5}.*142 m.*±5 m$/);
    expect(screen.getByTestId('gps-position')).toHaveTextContent(/^18S UJ \d{5} \d{5}$/);
    // The arrow, ME and your grid all in the friendly blue; the crosshair grid stays plain.
    expect(screen.getByTestId('gps-position')).toHaveStyle({ color: themeColors('dark').friendly });
    expect(screen.getByText('ME')).toHaveStyle({ color: themeColors('dark').friendly });
    expect(screen.getByTestId('me-icon')).toHaveStyle({ color: themeColors('dark').friendly });
    expect(screen.getByTestId('readout-coordinate')).not.toHaveStyle({ color: themeColors('dark').danger });
    // The CTR icon is the app's crosshair: white arms, amber dot.
    expect(screen.getByTestId('crosshair-dot')).toHaveStyle({ backgroundColor: themeColors('dark').accent });
    expect(screen.getByTestId('gps-altitude')).toHaveTextContent('ALT 142 m');
    expect(screen.getByTestId('gps-accuracy')).toHaveTextContent('±5 m');
    expect(screen.getByTestId('dock-center')).toHaveTextContent(/CTR/);
    expect(screen.getByTestId('readout-coordinate')).toHaveTextContent(formatCoordinate(CENTER, 'mgrs'));
    expect(screen.getByTestId('readout-range')).toHaveTextContent('987 m');
    expect(screen.getByTestId('readout-bearing')).toHaveTextContent(/^\d{3}°$/);
  });

  it('inline (landscape): sized to its content, each row\'s details on one line after its grid', async () => {
    useInteraction.getState().setCamera({ center: CENTER, zoom: 12, bearing: 0 });
    fix(142.4);
    await renderWithProviders(<ReadoutDock {...PROPS} showCenter inline maxWidth={300} />);
    const dock = screen.getByTestId('readout-dock');
    expect(dock.props.className).not.toContain('mx-2');
    expect(dock).toHaveStyle({ maxWidth: 300 });
    for (const row of ['dock-center', 'dock-self-row']) {
      expect(screen.getByTestId(`${row}-details`).props.className).toContain('flex-row');
    }
    for (const id of ['readout-range', 'readout-bearing']) expect(screen.getByTestId('dock-center-details')).toContainElement(screen.getByTestId(id));
    for (const id of ['gps-altitude', 'gps-accuracy']) expect(screen.getByTestId('dock-self-row-details')).toContainElement(screen.getByTestId(id));
    // ME's labelled altitude is longer: its two details sit closer together than CTR's.
    expect(screen.getByTestId('dock-self-row-details').props.className).toContain('gap-1');
    expect(screen.getByTestId('dock-self-row-details').props.className).not.toContain('gap-1.5');
    expect(screen.getByTestId('dock-center-details').props.className).toContain('gap-1.5');
  });

  it('inline is tighter than the portrait dock: less padding, smaller grids, smaller icons', async () => {
    useInteraction.getState().setCamera({ center: CENTER, zoom: 12, bearing: 0 });
    fix(142.4);
    await renderWithProviders(<ReadoutDock {...PROPS} showCenter inline />);
    expect(screen.getByTestId('readout-dock').props.className).toContain('px-2');
    expect(screen.getByTestId('dock-center').props.className).toContain('py-1');
    expect(screen.getByTestId('dock-center').props.className).not.toContain('min-h-12');
    expect(screen.getByTestId('readout-coordinate').props.className).toContain('text-base');
    expect(screen.getByTestId('gps-position').props.className).toContain('text-base');
    expect(screen.getByTestId('me-icon')).toHaveStyle({ fontSize: 12 });
    await screen.unmount();
    await renderWithProviders(<ReadoutDock {...PROPS} showCenter />);
    expect(screen.getByTestId('readout-coordinate').props.className).toContain('text-lg');
    expect(screen.getByTestId('dock-center').props.className).toContain('min-h-12');
  });

  it('inline keeps a fixed width: each live detail reserves room for its longest value', async () => {
    useInteraction.getState().setCamera({ center: CENTER, zoom: 12, bearing: 0 });
    fix(142.4);
    await renderWithProviders(<ReadoutDock {...PROPS} showCenter inline />);
    const reserves = () => screen.getAllByTestId('detail-reserve', HIDDEN).map((r) => r.props.children);
    expect(reserves()).toEqual(['0000 km', '000°', 'ALT 0000 m', '±0000 m']);
    await screen.unmount();
    await act(async () => useSettings.setState({ altitudeUnit: 'ft', angleUnit: 'mil' }));
    await renderWithProviders(<ReadoutDock {...PROPS} showCenter inline />);
    expect(reserves()).toEqual(['0000 km', '0000 mils', 'ALT 00000 ft', '±00000 ft']);
    await screen.unmount();
    await renderWithProviders(<ReadoutDock {...PROPS} showCenter />);
    expect(screen.queryAllByTestId('detail-reserve', HIDDEN)).toHaveLength(0);
  });

  it('minimal shows only each row\'s lead and grid', async () => {
    useInteraction.getState().setCamera({ center: CENTER, zoom: 12, bearing: 0 });
    fix(142.4);
    await renderWithProviders(<ReadoutDock {...PROPS} showCenter inline minimal />);
    expect(screen.getByTestId('readout-coordinate')).toHaveTextContent(formatCoordinate(CENTER, 'mgrs'));
    expect(screen.getByTestId('gps-position')).toHaveTextContent(/^18S UJ \d{5} \d{5}$/);
    for (const id of ['dock-center-details', 'dock-self-row-details', 'readout-range', 'readout-bearing', 'gps-altitude', 'gps-accuracy']) {
      expect(screen.queryByTestId(id)).toBeNull();
    }
  });

  it('stacks each row\'s details in portrait', async () => {
    useInteraction.getState().setCamera({ center: CENTER, zoom: 12, bearing: 0 });
    fix(142.4);
    await renderWithProviders(<ReadoutDock {...PROPS} showCenter />);
    expect(screen.getByTestId('dock-center-details').props.className).toContain('items-end');
    expect(screen.getByTestId('dock-center-details').props.className).not.toContain('flex-row');
  });

  it('gives all the CTR and ME text, and their icons, a crisp dark edge, so they read over snow', async () => {
    useInteraction.getState().setCamera({ center: CENTER, zoom: 12, bearing: 0 });
    fix(142.4);
    await renderWithProviders(<ReadoutDock {...PROPS} showCenter />);
    const ctr = within(screen.getByTestId('dock-center'));
    expect(ctr.getAllByTestId('crosshair-outline', HIDDEN)).toHaveLength(4);
    for (const text of ['CTR', formatCoordinate(CENTER, 'mgrs')]) expect(ctr.getAllByTestId('text-outline', HIDDEN).filter((c) => c.props.children === text)).toHaveLength(8);
    const me = within(screen.getByTestId('dock-self'));
    expect(me.getAllByTestId('icon-outline', HIDDEN)).toHaveLength(8);
    for (const text of ['ME', formatCoordinate(DC, 'mgrs')]) expect(me.getAllByTestId('text-outline', HIDDEN).filter((c) => c.props.children === text)).toHaveLength(8);
    for (const id of ['readout-range', 'readout-bearing', 'gps-altitude', 'gps-accuracy']) expect(edgesOf(screen.getByTestId(id).props.children)).toHaveLength(8);
    // Value colors: each kind of value has its own color, your grid the friendly blue (see AGENTS.md).
    const c = themeColors('dark');
    expect(screen.getByTestId('readout-range')).toHaveStyle({ color: c['value-distance'] });
    expect(screen.getByTestId('readout-bearing')).toHaveStyle({ color: c['value-bearing'] });
    expect(screen.getByTestId('gps-altitude')).toHaveStyle({ color: c['value-altitude'] });
    expect(screen.getByTestId('gps-accuracy')).toHaveStyle({ color: c['value-accuracy'] });
    await act(async () => useOp.setState({ ...INITIAL_OP, phase: 'on', at: DC, groundM: 300 }));
    expect(edgesOf('FROM OP')).toHaveLength(8);
  });

  it('leaves the CTR row out when the center grid is not shown', async () => {
    fix(10);
    await renderWithProviders(<ReadoutDock {...PROPS} showCenter={false} />);
    expect(screen.queryByTestId('dock-center')).toBeNull();
    expect(screen.queryByTestId('dock-divider')).toBeNull();
    expect(screen.getByTestId('dock-self')).toBeTruthy();
  });

  it('waits for GPS without a fix, with dashes for distance and bearing', async () => {
    useInteraction.getState().setCamera({ center: CENTER, zoom: 12, bearing: 0 });
    await renderWithProviders(<ReadoutDock {...PROPS} showCenter />);
    expect(screen.getByTestId('dock-self')).toHaveTextContent(/Waiting for GPS…/);
    expect(screen.getAllByText('Waiting for GPS…').at(-1)).toHaveStyle({ color: themeColors('dark').friendly });
    expect(edgesOf('Waiting for GPS…')).toHaveLength(8);
    expect(screen.queryByTestId('gps-altitude')).toBeNull();
    expect(screen.getByTestId('readout-range')).toHaveTextContent('—');
    expect(screen.getByTestId('readout-bearing')).toHaveTextContent('—');
  });

  it('holds the space of a grid and its details while waiting for GPS, so the card does not grow when the fix arrives', async () => {
    await renderWithProviders(<ReadoutDock {...PROPS} showCenter />);
    expect(screen.getByTestId('gps-position-placeholder', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByTestId('dock-self-row-details')).toBeTruthy();
    expect(screen.queryByTestId('gps-position')).toBeNull();
  });

  it('says location is off when it is denied', async () => {
    await renderWithProviders(<ReadoutDock {...PROPS} showCenter />);
    await act(async () => usePresence.getState().setLocationStatus('denied'));
    expect(screen.getByTestId('dock-self')).toHaveTextContent(/Location is off/);
    expect(screen.getAllByText('Location is off').at(-1)).toHaveStyle({ color: themeColors('dark').friendly });
    expect(edgesOf('Location is off')).toHaveLength(8);
  });

  it('centers Tap to set your location on the row, beside the space held for the two detail lines, not on the lower one', async () => {
    await renderWithProviders(<ReadoutDock {...PROPS} showCenter />);
    await act(async () => usePresence.getState().setLocationStatus('denied'));
    const details = screen.getByTestId('dock-self-row-details');
    // The hint's frame is the only thing in the details column, so the column centers it on the row.
    expect(details.children).toHaveLength(1);
    const frame = within(details).getByTestId('set-location-hint-frame');
    expect(frame).toHaveTextContent(/Tap to set your location/);
    expect(frame.props.className).toMatch(/\bflex-row\b/);
    expect(frame.props.className).toMatch(/\bitems-center\b/);
  });

  it('shows altitude and accuracy in the altitude unit, and a dash for an unknown altitude', async () => {
    useSettings.getState().setAltitudeUnit('ft');
    fix(null);
    await renderWithProviders(<ReadoutDock {...PROPS} showCenter={false} />);
    expect(screen.getByTestId('gps-altitude')).toHaveTextContent('ALT —');
    expect(screen.getByTestId('gps-accuracy')).toHaveTextContent('±15 ft');
  });

  describe('in Average mode', () => {
    const averaged = () => usePresence.getState().setSelfPosition({ position: DC, accuracyM: 2, timestamp: 1, altitudeM: 142, averaged: true });
    const averaging = () => {
      useGpsAverage.getState().start();
      averaged();
    };
    const paused = () => {
      useGpsAverage.setState({ phase: 'paused', fixCount: 86, pausedAt: 1 });
      averaged();
    };

    it('leads the ME row with an orange AVG while averaged, keeping the grid friendly blue and ALT white', async () => {
      averaging();
      await renderWithProviders(<ReadoutDock {...PROPS} showCenter={false} />);
      const c = themeColors('dark');
      expect(screen.getByTestId('me-icon')).toHaveStyle({ color: c.averaged });
      expect(screen.getByText('AVG')).toHaveStyle({ color: c.averaged });
      expect(screen.queryByText('ME')).toBeNull();
      expect(screen.getByTestId('gps-position')).toHaveStyle({ color: c.friendly });
      expect(screen.getByTestId('gps-altitude')).toHaveStyle({ color: c['value-altitude'] });
      expect(screen.getByTestId('gps-accuracy')).toHaveTextContent('±2 m');
      expect(screen.getByTestId('gps-accuracy')).toHaveStyle({ color: c['value-accuracy'] });
      expect(screen.getByLabelText('Averaged, accuracy ±2 m')).toBeTruthy();
      expect(screen.queryByTestId('gps-held')).toBeNull();
    });

    it('frames the dock in orange with the status line on top, and no buttons while averaging', async () => {
      averaging();
      await renderWithProviders(<ReadoutDock {...PROPS} showCenter />);
      expect(screen.getByTestId('readout-dock').props.className).toContain('border-averaged');
      expect(screen.getByTestId('average-header')).toHaveTextContent(/AVERAGE MODE.*hold still/);
      expect(screen.getByTestId('average-detail')).toHaveTextContent('0:00 · 0 fixes');
      expect(screen.queryByTestId('average-actions')).toBeNull();
    });

    it('marks a held average with HELD before the accuracy, and offers Resume and Stop below the grids', async () => {
      paused();
      await renderWithProviders(<ReadoutDock {...PROPS} showCenter />);
      const c = themeColors('dark');
      expect(screen.getByTestId('gps-held')).toHaveTextContent('HELD');
      expect(screen.getByTestId('gps-held')).toHaveStyle({ color: c.averaged });
      expect(screen.getByLabelText('Held average, accuracy ±2 m')).toBeTruthy();
      expect(screen.getByTestId('average-header')).toHaveTextContent(/PAUSED.*you moved/);
      expect(screen.getByTestId('average-detail')).toHaveTextContent('86 fixes kept');
      expect(screen.getByRole('button', { name: 'Resume' })).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Stop' })).toBeTruthy();
    });

    it('keeps HELD in feet too, reserving its width inline', async () => {
      useSettings.getState().setAltitudeUnit('ft');
      paused();
      await renderWithProviders(<ReadoutDock {...PROPS} showCenter={false} inline />);
      expect(screen.getByTestId('gps-accuracy')).toHaveTextContent('±7 ft');
      expect(screen.getByLabelText('Held average, accuracy ±7 ft')).toBeTruthy();
      expect(screen.getAllByTestId('detail-reserve', HIDDEN).map((n) => n.props.children)).toContain('HELD ±00000 ft');
    });

    it('looks as before when Average mode is off', async () => {
      fix(142.4);
      await renderWithProviders(<ReadoutDock {...PROPS} showCenter={false} />);
      expect(screen.queryByTestId('gps-held')).toBeNull();
      expect(screen.queryByTestId('average-header')).toBeNull();
      expect(screen.getByTestId('readout-dock').props.className).not.toContain('border-averaged');
      expect(screen.getByText('ME')).toHaveStyle({ color: themeColors('dark').friendly });
      expect(screen.getByTestId('me-icon')).toHaveStyle({ color: themeColors('dark').friendly });
    });
  });

  it('recenters when the ME row is tapped, adds no accent border while following, and does nothing while disabled', async () => {
    const onRecenter = jest.fn();
    await renderWithProviders(<ReadoutDock following disabled={false} onRecenter={onRecenter} onSetLocation={() => {}} showCenter />);
    await fireEvent.press(screen.getByLabelText('Recenter on me'));
    expect(onRecenter).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('dock-self')).toBeSelected();
    expect(screen.getByTestId('readout-dock').props.className).not.toContain('border-accent');
    await screen.unmount();
    await renderWithProviders(<ReadoutDock following={false} disabled onRecenter={onRecenter} onSetLocation={() => {}} showCenter />);
    await fireEvent.press(screen.getByLabelText('Recenter on me'));
    expect(onRecenter).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('readout-dock').props.className).not.toContain('border-accent');
  });

  it('in OP mode the ME row becomes the OP: its grid and true ground elevation, not tappable', async () => {
    fix(142.4);
    const onRecenter = jest.fn();
    // Drawn ground 450 m at the 1.5× terrain height is 300 m true.
    useOp.setState({ ...INITIAL_OP, phase: 'on', at: CENTER, groundM: 450 });
    await renderWithProviders(<ReadoutDock {...PROPS} onRecenter={onRecenter} showCenter={false} />);
    expect(screen.getByTestId('dock-self-row')).toHaveTextContent(/OP/);
    expect(screen.getByTestId('op-position')).toHaveTextContent(formatCoordinate(CENTER, 'mgrs'));
    expect(screen.getByTestId('op-elevation')).toHaveTextContent('ALT 300 m');
    expect(screen.queryByTestId('gps-position')).toBeNull();
    // The binoculars, OP, its grid and elevation have a crisp dark edge, like the ME row.
    expect(within(screen.getByTestId('dock-self')).getAllByTestId('icon-outline', HIDDEN)).toHaveLength(8);
    for (const text of ['OP', formatCoordinate(CENTER, 'mgrs'), 'ALT 300 m']) expect(edgesOf(text)).toHaveLength(8);
    await fireEvent.press(screen.getByTestId('dock-self'));
    expect(onRecenter).not.toHaveBeenCalled();
    await act(async () => useSettings.setState({ altitudeUnit: 'ft' }));
    expect(screen.getByTestId('op-elevation')).toHaveTextContent('ALT 984 ft');
    await act(async () => useOp.setState(INITIAL_OP));
    expect(screen.getByTestId('dock-self-row')).toHaveTextContent(/ME/);
  });

  it('is see-through, with no border, in and out of OP mode', async () => {
    await renderWithProviders(<ReadoutDock {...PROPS} showCenter />);
    expect(screen.getByTestId('readout-dock').props.className).toContain('bg-surface-glass');
    expect(screen.getByTestId('readout-dock').props.className).not.toContain('bg-surface-chrome');
    expect(screen.getByTestId('readout-dock').props.className).not.toContain('border');
    await act(async () => useOp.setState({ ...INITIAL_OP, phase: 'on', at: CENTER, groundM: 300 }));
    expect(screen.getByTestId('readout-dock').props.className).toContain('bg-surface-glass');
  });

  it('keeps the small text bright and outlined, in and out of OP mode', async () => {
    useInteraction.getState().setCamera({ center: CENTER, zoom: 12, bearing: 0 });
    fix(142.4);
    await renderWithProviders(<ReadoutDock {...PROPS} showCenter />);
    for (const id of ['readout-bearing', 'readout-range', 'readout-coordinate', 'gps-position', 'gps-altitude', 'gps-accuracy']) {
      const el = screen.getByTestId(id);
      expect(el.props.className).not.toContain('text-text-muted');
      expect(el).toHaveStyle({ textShadowRadius: 3 });
    }
    await act(async () => useOp.setState({ ...INITIAL_OP, phase: 'on', at: DC, groundM: 300 }));
    for (const id of ['readout-bearing', 'readout-from-op', 'readout-range', 'op-elevation']) {
      const el = screen.getByTestId(id);
      expect(el.props.className).not.toContain('text-text-muted');
      expect(el).toHaveStyle({ textShadowRadius: 3 });
    }
  });

  it('in OP mode measures from the OP and says so', async () => {
    const OP = { lat: 38.9, lon: -77.03 };
    const FAR = { lat: 40, lon: -75 };
    usePresence.getState().setSelfPosition({ position: FAR, accuracyM: 4, timestamp: 1, altitudeM: 1 });
    useOp.setState({ ...INITIAL_OP, phase: 'on', at: OP });
    useInteraction.getState().setCamera({ center: CENTER, zoom: 12, bearing: 0 });
    const r = describeReadout(CENTER, OP, { coordinateFormat: 'mgrs', angleUnit: 'deg', northRef: 'grid', declinationOverrideDeg: null }, new Date());
    await renderWithProviders(<ReadoutDock {...PROPS} showCenter />);
    expect(screen.getByTestId('readout-range')).toHaveTextContent(r.distance);
    expect(screen.getByTestId('readout-bearing')).toHaveTextContent(r.bearing);
    expect(screen.getByTestId('readout-from-op')).toHaveTextContent('FROM OP');
    expect(screen.getByTestId('readout-range').props.accessibilityLabel).toContain('from the OP');
  });

  it('shows no FROM tag when measuring from a manual position (screen readers still hear it is manual)', async () => {
    usePresence.getState().setSelfPosition({ position: DC, accuracyM: null, timestamp: 1, manual: true });
    useInteraction.getState().setCamera({ center: CENTER, zoom: 12, bearing: 0 });
    await renderWithProviders(<ReadoutDock {...PROPS} showCenter />);
    expect(screen.queryByText(/FROM ME/)).toBeNull();
    expect(screen.getByTestId('readout-range').props.accessibilityLabel).toMatch(/^Distance from you \(manual position\)/);
  });

  describe('setting a location by hand', () => {
    it('with location off, offers to set the location by hand and opens it on tap, even while disabled', async () => {
      usePresence.getState().setLocationStatus('denied');
      const onSetLocation = jest.fn();
      const onRecenter = jest.fn();
      await renderWithProviders(<ReadoutDock {...PROPS} showCenter disabled onRecenter={onRecenter} onSetLocation={onSetLocation} />);
      expect(screen.getAllByText('Location is off').length).toBeGreaterThan(0);
      expect(screen.getByTestId('set-location-hint')).toHaveTextContent('Tap to set your location');
      await fireEvent.press(screen.getByLabelText('Set your location'));
      expect(onSetLocation).toHaveBeenCalledTimes(1);
      expect(onRecenter).not.toHaveBeenCalled();
    });

    it('says the manual position is not set when Manual is chosen without one', async () => {
      useMyLocation.getState().switchToManual();
      usePresence.getState().setLocationStatus('granted');
      const onSetLocation = jest.fn();
      await renderWithProviders(<ReadoutDock {...PROPS} showCenter disabled onSetLocation={onSetLocation} />);
      expect(screen.getAllByText('Manual position not set').length).toBeGreaterThan(0);
      await fireEvent.press(screen.getByLabelText('Set your location'));
      expect(onSetLocation).toHaveBeenCalledTimes(1);
    });

    it('shows a manual position with MANUAL and no altitude, and recenters on tap', async () => {
      usePresence.getState().setLocationStatus('denied');
      usePresence.getState().setSelfPosition({ position: { lat: 38.8977, lon: -77.0365 }, accuracyM: null, timestamp: 1, manual: true });
      const onRecenter = jest.fn();
      await renderWithProviders(<ReadoutDock {...PROPS} showCenter onRecenter={onRecenter} />);
      expect(screen.getByTestId('gps-position')).toBeTruthy();
      expect(screen.getByTestId('gps-manual')).toHaveTextContent('MANUAL');
      expect(screen.queryByTestId('gps-altitude')).toBeNull();
      expect(screen.queryByTestId('set-location-hint')).toBeNull();
      await fireEvent.press(screen.getByLabelText('Recenter on me'));
      expect(onRecenter).toHaveBeenCalledTimes(1);
    });

    it('says the manual position is not set (not that location is off) when Manual has none and location is off', async () => {
      useMyLocation.getState().switchToManual();
      usePresence.getState().setLocationStatus('denied');
      await renderWithProviders(<ReadoutDock {...PROPS} showCenter disabled />);
      expect(screen.getAllByText('Manual position not set').length).toBeGreaterThan(0);
      expect(screen.queryAllByText('Location is off')).toHaveLength(0);
    });
  });
});
