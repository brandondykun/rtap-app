import { act, screen, within } from '@testing-library/react-native';

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
    expect(screen.getByTestId('center-card')).toHaveTextContent(new RegExp(`^CTR.*${formatCoordinate(DC, 'mgrs')}DIST`));
    expect(screen.getByTestId('readout-coordinate')).toHaveTextContent(formatCoordinate(DC, 'mgrs'));
    // The crosshair, CTR and the grid have a crisp dark edge, so they read over snow.
    const card = within(screen.getByTestId('center-card'));
    expect(card.getAllByTestId('crosshair-outline', { includeHiddenElements: true })).toHaveLength(4);
    for (const text of ['CTR', formatCoordinate(DC, 'mgrs')]) expect(card.getAllByTestId('text-outline', { includeHiddenElements: true }).filter((c) => c.props.children === text)).toHaveLength(8);
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
    expect((screen.getByTestId('center-card').children[1] as unknown as { props: { className: string } }).props.className).toContain('mt-0.5');
    // With a crisp dark edge, like the rest of the card.
    const vector = screen.getByTestId('center-vector').props.children;
    expect(screen.getAllByTestId('text-outline', { includeHiddenElements: true }).filter((c) => c.props.children === vector)).toHaveLength(8);
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

  it('is see-through, with no border, in and out of OP mode', async () => {
    await renderWithProviders(<CenterCard />);
    expect(screen.getByTestId('center-card').props.className).toContain('bg-surface-glass');
    expect(screen.getByTestId('center-card').props.className).not.toContain('border');
    expect(screen.getByTestId('center-vector').props.className).not.toContain('text-text-muted');
    expect(screen.getByTestId('center-vector')).toHaveStyle({ textShadowRadius: 3 });
    await screen.unmount();
    useOp.setState({ ...INITIAL_OP, phase: 'on', at: { lat: 38.9, lon: -77 } });
    await renderWithProviders(<CenterCard />);
    expect(screen.getByTestId('center-card').props.className).toContain('bg-surface-glass');
  });

  it('in OP mode brightens the distance line and outlines it', async () => {
    useOp.setState({ ...INITIAL_OP, phase: 'on', at: { lat: 38.9, lon: -77 } });
    await renderWithProviders(<CenterCard />);
    const vector = screen.getByTestId('center-vector');
    expect(vector.props.className).not.toContain('text-text-muted');
    expect(vector).toHaveStyle({ textShadowRadius: 3 });
  });

  it('adds nothing after DIR when measuring from a manual position, and still says FROM OP in OP mode', async () => {
    useInteraction.getState().setCamera({ center: CENTER, zoom: 12, bearing: 0 });
    usePresence.getState().setSelfPosition({ position: DC, accuracyM: null, timestamp: 1, manual: true });
    await renderWithProviders(<CenterCard />);
    expect(screen.getByTestId('center-vector')).toHaveTextContent(/^DIST .+ · DIR \d{3}°$/);
    await act(async () => useOp.setState({ ...INITIAL_OP, phase: 'on', at: CENTER }));
    expect(screen.getByTestId('center-vector')).toHaveTextContent(/ FROM OP$/);
  });
});
