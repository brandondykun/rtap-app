import { act, fireEvent, screen, within } from '@testing-library/react-native';

import { DEFAULT_MY_LOCATION, useMyLocation } from '@/stores/my-location';
import { INITIAL_OP, useOp } from '@/stores/op';
import { INITIAL_PRESENCE, usePresence } from '@/stores/presence';
import { DEFAULT_SETTINGS, useSettings } from '@/stores/settings';
import { renderWithProviders } from '@/test-utils/render';
import { themeColors } from '@/theme/tokens';

import { SelfCard } from './SelfCard';

/** The dark copies drawn under a text to outline it. */
const edgesOf = (text: string) => screen.queryAllByTestId('text-outline', { includeHiddenElements: true }).filter((c) => c.props.children === text);
const PROPS = { following: false, disabled: false, onRecenter: () => {}, onSetLocation: () => {} };

const fix = (altitudeM: number | null) =>
  usePresence.getState().setSelfPosition({ position: { lat: 38.8977, lon: -77.0365 }, accuracyM: 4.6, timestamp: 1, altitudeM });

beforeEach(() => {
  usePresence.setState(INITIAL_PRESENCE);
  useSettings.setState(DEFAULT_SETTINGS);
  useOp.setState(INITIAL_OP);
  useMyLocation.setState(DEFAULT_MY_LOCATION);
});

describe('SelfCard', () => {
  it('puts ME and your grid on the first line, ALT and ACC on the second', async () => {
    fix(142.4);
    await renderWithProviders(<SelfCard {...PROPS} />);
    const lines = screen.getByTestId('gps-readout').children as unknown[];
    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe(screen.getByTestId('gps-line'));
    expect(lines[1]).toContainElement(screen.getByTestId('gps-altitude'));
    expect(screen.getByTestId('gps-line')).toHaveTextContent(/ME18S UJ \d{5} \d{5}/);
    expect(screen.getByTestId('gps-position')).toHaveTextContent(/^18S UJ \d{5} \d{5}$/);
    expect(screen.getByTestId('gps-altitude')).toHaveTextContent('ALT 142 m · ACC ±5 m');
    expect(screen.getByTestId('gps-altitude')).toHaveStyle({ color: themeColors('dark').friendly });
    expect(edgesOf(screen.getByTestId('gps-altitude').props.children)).toHaveLength(8);
    // Like the portrait dock: the arrow, ME and your grid all in the friendly blue.
    expect(screen.getByTestId('gps-position')).toHaveStyle({ color: themeColors('dark').friendly });
    // The arrow, ME and your grid have a crisp dark edge, so the light blue reads over snow.
    const line = within(screen.getByTestId('gps-line'));
    expect(line.getAllByTestId('icon-outline', { includeHiddenElements: true })).toHaveLength(8);
    expect(line.getAllByTestId('text-outline', { includeHiddenElements: true }).map((c) => c.props.children)).toEqual([...Array(8).fill('ME'), ...Array(8).fill(screen.getByTestId('gps-position').props.children)]);
    expect(screen.getByText('ME')).toHaveStyle({ color: themeColors('dark').friendly });
    expect(screen.getByTestId('me-icon')).toHaveStyle({ color: themeColors('dark').friendly });
  });

  it('waits for the first fix', async () => {
    await renderWithProviders(<SelfCard {...PROPS} />);
    expect(screen.getAllByText('Waiting for GPS…').at(-1)).toHaveStyle({ color: themeColors('dark').friendly });
    expect(edgesOf('Waiting for GPS…')).toHaveLength(8);
    expect(screen.queryByTestId('gps-altitude')).toBeNull();
  });

  it('shows ALT and ACC in the altitude unit, and a dash for an unknown altitude', async () => {
    await renderWithProviders(<SelfCard {...PROPS} />);
    await act(async () => fix(null));
    expect(screen.getByTestId('gps-altitude')).toHaveTextContent('ALT — · ACC ±5 m');
    await act(async () => {
      fix(142.4);
      useSettings.getState().setAltitudeUnit('ft');
      useSettings.getState().setCoordinateFormat('latlon');
    });
    expect(screen.getByTestId('gps-altitude')).toHaveTextContent('ALT 467 ft · ACC ±15 ft');
    expect(screen.getByTestId('gps-position')).not.toHaveTextContent(/^18S/);
  });

  it('says location is off when it is denied', async () => {
    await renderWithProviders(<SelfCard {...PROPS} />);
    await act(async () => usePresence.getState().setLocationStatus('denied'));
    expect(screen.getAllByText('Location is off').at(-1)).toHaveStyle({ color: themeColors('dark').friendly });
    expect(edgesOf('Location is off')).toHaveLength(8);
  });

  it('recenters on press, shows following, and does nothing while disabled', async () => {
    const onRecenter = jest.fn();
    await renderWithProviders(<SelfCard following disabled={false} onRecenter={onRecenter} onSetLocation={() => {}} />);
    await fireEvent.press(screen.getByLabelText('Recenter on me'));
    expect(onRecenter).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('Recenter on me')).toBeSelected();
    // Following is for screen readers only: the border stays plain.
    expect(screen.getByTestId('gps-readout').props.className).not.toContain('border-accent');
    await screen.unmount();
    await renderWithProviders(<SelfCard following={false} disabled onRecenter={onRecenter} onSetLocation={() => {}} />);
    await fireEvent.press(screen.getByLabelText('Recenter on me'));
    expect(onRecenter).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('Recenter on me')).not.toBeSelected();
  });

  it('is see-through with bright, outlined text', async () => {
    fix(142.4);
    await renderWithProviders(<SelfCard {...PROPS} />);
    expect(screen.getByTestId('gps-readout').props.className).toContain('bg-surface-glass');
    expect(screen.getByTestId('gps-readout').props.className).not.toContain('border');
    for (const id of ['gps-position', 'gps-altitude']) {
      expect(screen.getByTestId(id).props.className).not.toContain('text-text-muted');
      expect(screen.getByTestId(id)).toHaveStyle({ textShadowRadius: 3 });
    }
  });

  it('in OP mode shows the OP: its grid and ground elevation, not tappable', async () => {
    fix(142.4);
    const onRecenter = jest.fn();
    useOp.setState({ ...INITIAL_OP, phase: 'on', at: { lat: 38.905, lon: -77.03 }, groundM: 450 });
    await renderWithProviders(<SelfCard {...PROPS} onRecenter={onRecenter} />);
    expect(screen.getByTestId('gps-line')).toHaveTextContent(/OP.*18S UJ \d{5} \d{5}$/);
    expect(screen.getByTestId('op-elevation')).toHaveTextContent('ELV 300 m');
    // The binoculars, OP, its grid and elevation have a crisp dark edge, like the ME card.
    expect(within(screen.getByTestId('gps-line')).getAllByTestId('icon-outline', { includeHiddenElements: true })).toHaveLength(8);
    for (const text of ['OP', screen.getByTestId('op-position').props.children, 'ELV 300 m']) expect(edgesOf(text)).toHaveLength(8);
    await fireEvent.press(screen.getByTestId('gps-readout'));
    expect(onRecenter).not.toHaveBeenCalled();
  });

  it('in OP mode goes see-through, with the elevation brightened and outlined', async () => {
    useOp.setState({ ...INITIAL_OP, phase: 'on', at: { lat: 38.905, lon: -77.03 }, groundM: 450 });
    await renderWithProviders(<SelfCard {...PROPS} />);
    expect(screen.getByTestId('gps-readout').props.className).toContain('bg-surface-glass');
    expect(screen.getByTestId('gps-readout').props.className).not.toContain('bg-surface-chrome');
    const elevation = screen.getByTestId('op-elevation');
    expect(elevation.props.className).not.toContain('text-text-muted');
    expect(elevation).toHaveStyle({ textShadowRadius: 3 });
    expect(screen.getByTestId('op-position')).toHaveStyle({ textShadowRadius: 3 });
  });

  it('in OP mode shows a dash for the elevation until the ground is read', async () => {
    useOp.setState({ ...INITIAL_OP, phase: 'on', at: { lat: 38.905, lon: -77.03 }, groundM: null });
    await renderWithProviders(<SelfCard {...PROPS} />);
    expect(screen.getByTestId('op-elevation')).toHaveTextContent('ELV —');
  });

  describe('setting a location by hand', () => {
    it('with location off, offers to set the location by hand and opens it on tap, even while disabled', async () => {
      usePresence.getState().setLocationStatus('denied');
      const onSetLocation = jest.fn();
      const onRecenter = jest.fn();
      await renderWithProviders(<SelfCard {...PROPS} disabled onRecenter={onRecenter} onSetLocation={onSetLocation} />);
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
      await renderWithProviders(<SelfCard {...PROPS} disabled onSetLocation={onSetLocation} />);
      expect(screen.getAllByText('Manual position not set').length).toBeGreaterThan(0);
      await fireEvent.press(screen.getByLabelText('Set your location'));
      expect(onSetLocation).toHaveBeenCalledTimes(1);
    });

    it('shows a manual position with MANUAL and no altitude, and recenters on tap', async () => {
      usePresence.getState().setLocationStatus('denied');
      usePresence.getState().setSelfPosition({ position: { lat: 38.8977, lon: -77.0365 }, accuracyM: null, timestamp: 1, manual: true });
      const onRecenter = jest.fn();
      await renderWithProviders(<SelfCard {...PROPS} onRecenter={onRecenter} />);
      expect(screen.getByTestId('gps-position')).toBeTruthy();
      expect(screen.getByTestId('gps-manual')).toHaveTextContent('MANUAL');
      expect(screen.queryByTestId('gps-altitude')).toBeNull();
      expect(screen.queryByTestId('set-location-hint')).toBeNull();
      await fireEvent.press(screen.getByLabelText('Recenter on me'));
      expect(onRecenter).toHaveBeenCalledTimes(1);
    });
  });
});
