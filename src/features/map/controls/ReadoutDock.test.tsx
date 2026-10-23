import { act, fireEvent, screen, within } from '@testing-library/react-native';

import { describeReadout, formatCoordinate } from '@/features/map/interaction/readout';
import { INITIAL_INTERACTION, useInteraction } from '@/stores/interaction';
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
const PROPS = { following: false, disabled: false, onRecenter: () => {} };

const fix = (altitudeM: number | null) => usePresence.getState().setSelfPosition({ position: DC, accuracyM: 4.6, timestamp: 1, altitudeM });

beforeEach(() => {
  useInteraction.setState(INITIAL_INTERACTION);
  usePresence.setState(INITIAL_PRESENCE);
  useSettings.setState(DEFAULT_SETTINGS);
  useOp.setState(INITIAL_OP);
});

describe('ReadoutDock', () => {
  it('puts CTR (the crosshair grid, distance over bearing from you) over ME (your grid, altitude over accuracy)', async () => {
    useInteraction.getState().setCamera({ center: CENTER, zoom: 12, bearing: 0 });
    fix(142.4);
    await renderWithProviders(<ReadoutDock {...PROPS} showCenter />);
    const rows = (screen.getByTestId('readout-dock').children as { props: { testID?: string } }[]).map((c) => c.props.testID);
    expect(rows).toEqual(['dock-center', 'dock-divider', 'dock-self']);
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
    expect(screen.getByTestId('gps-altitude')).toHaveTextContent('142 m');
    expect(screen.getByTestId('gps-accuracy')).toHaveTextContent('±5 m');
    expect(screen.getByTestId('dock-center')).toHaveTextContent(/CTR/);
    expect(screen.getByTestId('readout-coordinate')).toHaveTextContent(formatCoordinate(CENTER, 'mgrs'));
    expect(screen.getByTestId('readout-range')).toHaveTextContent('987 m');
    expect(screen.getByTestId('readout-bearing')).toHaveTextContent(/^\d{3}°$/);
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
    // Everything in the ME row is in the friendly blue.
    for (const id of ['gps-altitude', 'gps-accuracy']) expect(screen.getByTestId(id)).toHaveStyle({ color: themeColors('dark').friendly });
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

  it('says location is off when it is denied', async () => {
    await renderWithProviders(<ReadoutDock {...PROPS} showCenter />);
    await act(async () => usePresence.getState().setLocationStatus('denied'));
    expect(screen.getByTestId('dock-self')).toHaveTextContent(/Location is off/);
    expect(screen.getAllByText('Location is off').at(-1)).toHaveStyle({ color: themeColors('dark').friendly });
    expect(edgesOf('Location is off')).toHaveLength(8);
  });

  it('shows altitude and accuracy in the altitude unit, and a dash for an unknown altitude', async () => {
    useSettings.getState().setAltitudeUnit('ft');
    fix(null);
    await renderWithProviders(<ReadoutDock {...PROPS} showCenter={false} />);
    expect(screen.getByTestId('gps-altitude')).toHaveTextContent('—');
    expect(screen.getByTestId('gps-accuracy')).toHaveTextContent('±15 ft');
  });

  it('recenters when the ME row is tapped, adds no accent border while following, and does nothing while disabled', async () => {
    const onRecenter = jest.fn();
    await renderWithProviders(<ReadoutDock following disabled={false} onRecenter={onRecenter} showCenter />);
    await fireEvent.press(screen.getByLabelText('Recenter on me'));
    expect(onRecenter).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('dock-self')).toBeSelected();
    expect(screen.getByTestId('readout-dock').props.className).not.toContain('border-accent');
    await screen.unmount();
    await renderWithProviders(<ReadoutDock following={false} disabled onRecenter={onRecenter} showCenter />);
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
    expect(screen.getByTestId('op-elevation')).toHaveTextContent('ELV 300 m');
    expect(screen.queryByTestId('gps-position')).toBeNull();
    await fireEvent.press(screen.getByTestId('dock-self'));
    expect(onRecenter).not.toHaveBeenCalled();
    await act(async () => useSettings.setState({ altitudeUnit: 'ft' }));
    expect(screen.getByTestId('op-elevation')).toHaveTextContent('ELV 984 ft');
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
});
