import { act, fireEvent, screen, within } from '@testing-library/react-native';

import { INITIAL_OP, useOp } from '@/stores/op';
import { INITIAL_PRESENCE, usePresence } from '@/stores/presence';
import { DEFAULT_SETTINGS, useSettings } from '@/stores/settings';
import { renderWithProviders } from '@/test-utils/render';
import { themeColors } from '@/theme/tokens';

import { SelfCard } from './SelfCard';

const PROPS = { following: false, disabled: false, onRecenter: () => {} };

const fix = (altitudeM: number | null) =>
  usePresence.getState().setSelfPosition({ position: { lat: 38.8977, lon: -77.0365 }, accuracyM: 4.6, timestamp: 1, altitudeM });

beforeEach(() => {
  usePresence.setState(INITIAL_PRESENCE);
  useSettings.setState(DEFAULT_SETTINGS);
  useOp.setState(INITIAL_OP);
});

describe('SelfCard', () => {
  it('puts ME and your grid on the first line, ALT and ACC on the second', async () => {
    fix(142.4);
    await renderWithProviders(<SelfCard {...PROPS} />);
    const lines = screen.getByTestId('gps-readout').children as unknown[];
    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe(screen.getByTestId('gps-line'));
    expect(lines[1]).toBe(screen.getByTestId('gps-altitude'));
    expect(screen.getByTestId('gps-line')).toHaveTextContent(/ME18S UJ \d{5} \d{5}/);
    expect(screen.getByTestId('gps-position')).toHaveTextContent(/^18S UJ \d{5} \d{5}$/);
    expect(screen.getByTestId('gps-altitude')).toHaveTextContent('ALT 142 m · ACC ±5 m');
    // Like the portrait dock: your grid in the friendly blue, the ME tag in your location blue.
    expect(screen.getByTestId('gps-position')).toHaveStyle({ color: themeColors('dark').friendly });
    // The arrow, ME and your grid have a crisp dark edge, so the light blue reads over snow.
    const line = within(screen.getByTestId('gps-line'));
    expect(line.getAllByTestId('icon-outline', { includeHiddenElements: true })).toHaveLength(8);
    expect(line.getAllByTestId('text-outline', { includeHiddenElements: true }).map((c) => c.props.children)).toEqual([...Array(8).fill('ME'), ...Array(8).fill(screen.getByTestId('gps-position').props.children)]);
    expect(screen.getByText('ME')).toHaveStyle({ color: themeColors('dark').self });
  });

  it('waits for the first fix', async () => {
    await renderWithProviders(<SelfCard {...PROPS} />);
    expect(screen.getByText('Waiting for GPS…')).toBeTruthy();
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
    expect(screen.getByText('Location is off')).toBeTruthy();
  });

  it('recenters on press, shows following, and does nothing while disabled', async () => {
    const onRecenter = jest.fn();
    await renderWithProviders(<SelfCard following disabled={false} onRecenter={onRecenter} />);
    await fireEvent.press(screen.getByLabelText('Recenter on me'));
    expect(onRecenter).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('Recenter on me')).toBeSelected();
    // Following is for screen readers only: the border stays plain.
    expect(screen.getByTestId('gps-readout').props.className).not.toContain('border-accent');
    await screen.unmount();
    await renderWithProviders(<SelfCard following={false} disabled onRecenter={onRecenter} />);
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
    expect(screen.getByTestId('gps-line')).toHaveTextContent(/OP18S UJ \d{5} \d{5}$/);
    expect(screen.getByTestId('op-elevation')).toHaveTextContent('ELV 300 m');
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
});
