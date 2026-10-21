import { screen } from '@testing-library/react-native';

import { describeReadout, formatCoordinate } from '@/features/map/interaction/readout';
import { INITIAL_INTERACTION, useInteraction } from '@/stores/interaction';
import { INITIAL_OP, useOp } from '@/stores/op';
import { INITIAL_PRESENCE, usePresence } from '@/stores/presence';
import { DEFAULT_SETTINGS, useSettings } from '@/stores/settings';
import { renderWithProviders } from '@/test-utils/render';
import { themeColors } from '@/theme/tokens';

import { CenterCard } from './CenterCard';

const DC = { lat: 38.8977, lon: -77.0365 };
const CENTER = { lat: 38.905, lon: -77.03 };
const fix = () => usePresence.getState().setSelfPosition({ position: DC, accuracyM: 4.6, timestamp: 1, altitudeM: 142 });

beforeEach(() => {
  useInteraction.setState(INITIAL_INTERACTION);
  usePresence.setState(INITIAL_PRESENCE);
  useSettings.setState(DEFAULT_SETTINGS);
  useOp.setState(INITIAL_OP);
});

describe('CenterCard', () => {
  it('shows CTR and the crosshair grid', async () => {
    useInteraction.getState().setCamera({ center: DC, zoom: 12, bearing: 0 });
    await renderWithProviders(<CenterCard />);
    expect(screen.getByTestId('center-card')).toHaveTextContent(new RegExp(`^CTR${formatCoordinate(DC, 'mgrs')}DIST`));
    expect(screen.getByTestId('readout-coordinate')).toHaveTextContent(formatCoordinate(DC, 'mgrs'));
    expect(screen.getByTestId('readout-coordinate')).not.toHaveStyle({ color: themeColors('dark').danger });
    // The CTR icon is the app's crosshair: white arms, amber dot.
    expect(screen.getByTestId('crosshair-dot')).toHaveStyle({ backgroundColor: themeColors('dark').accent });
  });

  it('adds a second line like the ME card: distance and bearing of the crosshair from you', async () => {
    useInteraction.getState().setCamera({ center: CENTER, zoom: 12, bearing: 0 });
    fix();
    await renderWithProviders(<CenterCard />);
    expect(screen.getByTestId('center-vector')).toHaveTextContent(/^DIST 987 m · DIR \d{3}°$/);
    // Same small, muted style as the ME card's ALT · ACC line, so the two cards match in size.
    expect(screen.getByTestId('center-vector').props.className).toContain('text-xs');
    expect(screen.getByTestId('center-vector').props.className).toContain('mt-0.5');
  });

  it('shows dashes for distance and bearing until there is a GPS fix', async () => {
    useInteraction.getState().setCamera({ center: CENTER, zoom: 12, bearing: 0 });
    await renderWithProviders(<CenterCard />);
    expect(screen.getByTestId('center-vector')).toHaveTextContent('DIST — · DIR —');
  });

  it('follows the coordinate format', async () => {
    useInteraction.getState().setCamera({ center: DC, zoom: 12, bearing: 0 });
    useSettings.getState().setCoordinateFormat('latlon');
    await renderWithProviders(<CenterCard />);
    expect(screen.getByTestId('readout-coordinate')).toHaveTextContent(formatCoordinate(DC, 'latlon'));
  });

  it('in OP mode measures from the OP and says so', async () => {
    const OP = { lat: 38.9, lon: -77.03 };
    const FAR = { lat: 40, lon: -75 };
    usePresence.getState().setSelfPosition({ position: FAR, accuracyM: 4, timestamp: 1, altitudeM: 1 });
    useOp.setState({ ...INITIAL_OP, phase: 'on', at: OP });
    useInteraction.getState().setCamera({ center: CENTER, zoom: 12, bearing: 0 });
    const r = describeReadout(CENTER, OP, { coordinateFormat: 'mgrs', angleUnit: 'deg', northRef: 'grid', declinationOverrideDeg: null }, new Date());
    await renderWithProviders(<CenterCard />);
    expect(screen.getByTestId('center-vector')).toHaveTextContent(`DIST ${r.distance} · DIR ${r.bearing} FROM OP`);
    expect(screen.getByTestId('center-vector').props.accessibilityLabel).toContain('from the OP');
  });
});
