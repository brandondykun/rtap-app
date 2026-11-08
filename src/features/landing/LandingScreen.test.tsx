import { fireEvent, screen, within } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { formatDistance } from '@/lib/geo/format/measure';
import { DEFAULT_PROFILE, useProfile } from '@/stores/profile';
import { renderWithProviders } from '@/test-utils/render';

import { LandingScreen } from './LandingScreen';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));

const mockDims = { width: 390, height: 844, scale: 3, fontScale: 1 };
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: () => mockDims }));

beforeEach(() => {
  useProfile.setState(DEFAULT_PROFILE);
  mockRouter.replace.mockClear();
  Object.assign(mockDims, { width: 390, height: 844 });
});

/** Gives the scene its room, as the layout pass would. */
async function layOutScene(width = 342, height = 300) {
  await fireEvent(screen.getByTestId('landing-scene'), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width, height } } });
}

describe('LandingScreen', () => {
  it('shows TACTICAL MAPPING, RTAP, its promise with Dominate in amber, and what it does in boxed amber icons', async () => {
    await renderWithProviders(<LandingScreen />);
    expect(screen.getByText('◆ TACTICAL MAPPING')).toBeTruthy();
    expect(screen.getByRole('header', { name: 'RTAP' })).toBeTruthy();
    // The app icon's symbol beside the wordmark, on the background itself (no tile), a little shorter than its capitals.
    expect(screen.getByLabelText('RTAP logo')).toHaveStyle({ height: 48, transform: [{ translateY: -4 }] });
    expect(screen.getByLabelText('RTAP logo').props.className).toBeUndefined();
    // Spelled out under it, small and muted.
    expect(screen.getByText('Realtime Team Awareness Platform').props.className).toMatch(/\btext-xs\b.*\btext-text-muted\b/);
    expect(screen.getByText('Locate. Communicate. Dominate.')).toBeTruthy();
    expect(screen.getByText('Dominate.').props.className).toContain('text-accent');
    const features = within(screen.getByTestId('landing-features'));
    for (const text of ['MGRS grids to the meter', 'Units, points, lines and areas', 'Range and azimuth at a glance']) expect(features.getByText(text)).toBeTruthy();
    // Each icon sits in its own bordered box, beside its line.
    for (const text of ['MGRS grids to the meter', 'Units, points, lines and areas', 'Range and azimuth at a glance']) {
      const box = features.getByText(text).parent!.children[0];
      expect(typeof box === 'object' && box.props.className).toMatch(/\brounded-lg border border-border\b/);
    }
  });

  it('Get started remembers the landing was seen and goes to the missions, with no way back', async () => {
    await renderWithProviders(<LandingScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Get started' }));
    expect(useProfile.getState().landingSeen).toBe(true);
    expect(mockRouter.replace).toHaveBeenCalledWith('/');
  });

  it('draws ALPHA-1 then BRAVO-2 measuring to HOS-1 in its dashed ring, once it has room', async () => {
    await renderWithProviders(<LandingScreen />);
    const scene = within(screen.getByTestId('landing-scene'));
    expect(scene.queryByTestId('landing-measure-label')).toBeNull();
    await layOutScene(334, 330);
    for (const name of ['ALPHA-1', 'BRAVO-2', 'HOS-1']) expect(scene.getByText(name)).toBeTruthy();
    // Each bearing is its line's own, worked out from where the units sit.
    expect(scene.getByTestId('landing-measure-label')).toHaveTextContent(/^1\.24 km · \d{4} mils$/);
    expect(scene.getByTestId('landing-measure-label-2')).toHaveTextContent(/^(\d+ m|\d\.\d\d km) · \d{4} mils$/);
    const paths = scene.getAllByTestId('skia-path');
    // The ring's fill and dashed edge, then the two measure lines, dashed amber and drawn in from nothing, both to the hostile.
    const lines = paths.filter((p) => /^M[\d.]+ [\d.]+ L[\d.]+ [\d.]+$/.test(p.props.path) && p.props.strokeWidth === 3);
    expect(lines).toHaveLength(2);
    const ends = lines.map((l) => l.props.path.split(' L')[1]);
    expect(ends[0]).toBe(ends[1]);
    for (const line of lines) {
      expect(line.props.strokeWidth).toBe(3);
      expect(line.props.end).toHaveProperty('value');
    }
    expect(paths.filter((p) => p.props.path.includes(' a54 54 '))).toHaveLength(2);
  });

  it('has ALPHA-1 report the hostile to BRAVO-2 in a dashed blue line, drawn in from nothing', async () => {
    await renderWithProviders(<LandingScreen />);
    await layOutScene(334, 330);
    const report = screen.getAllByTestId('skia-path').find((p) => p.props.strokeWidth === 2);
    expect(report).toBeTruthy();
    // From ALPHA-1 at (60.1, 99) to BRAVO-2 at (133.6, 270.6), in the friendly blue of their names.
    const [x1, y1, x2, y2] = (report!.props.path as string).match(/[\d.]+/g)!.map(Number);
    for (const [got, want] of [[x1, 60.1], [y1, 99], [x2, 133.6], [y2, 270.6]]) expect(got).toBeCloseTo(want, 0);
    expect(report!.props.color).toBe(StyleSheet.flatten(screen.getByText('ALPHA-1').props.style).color);
    expect(report!.props.end).toHaveProperty('value');
    expect(within(report!).getByTestId('skia-dash')).toBeTruthy();
  });

  it('writes mils in four digits, as everywhere in the app (0979, not 979)', async () => {
    await renderWithProviders(<LandingScreen />);
    // A scene a little narrower than tall puts the hostile a little under 1000 mils from BRAVO-2.
    await layOutScene(300, 330);
    expect(screen.getByTestId('landing-measure-label-2')).toHaveTextContent(/ · 0\d{3} mils$/);
  });

  it('gives BRAVO-2 its distance scaled from ALPHA-1\'s by how far each sits from the hostile', async () => {
    await renderWithProviders(<LandingScreen />);
    await layOutScene(334, 330);
    // ALPHA-1 at (60.1, 99), BRAVO-2 at (133.6, 270.6), HOS-1 at (267.2, 181.5).
    const ratio = Math.hypot(267.2 - 133.6, 181.5 - 270.6) / Math.hypot(267.2 - 60.1, 181.5 - 99);
    // Written as the map writes distances: under a kilometer in meters.
    expect(screen.getByTestId('landing-measure-label-2')).toHaveTextContent(new RegExp(`^${formatDistance(1240 * ratio)} · `));
  });

  it("fades the hostile's ring in only once ALPHA-1's line has reached it", async () => {
    await renderWithProviders(<LandingScreen />);
    await layOutScene(334, 330);
    const ring = screen.getByTestId('skia-group');
    expect(within(ring).getAllByTestId('skia-path').filter((p) => p.props.path.includes(' a54 54 '))).toHaveLength(2);
    // Animated in (the mock runs animations to their end at once), not drawn from the start.
    expect(ring.props.opacity).toHaveProperty('value', 1);
  });

  it('pings a thin ring out of the hostile, growing and fading, instead of flashing', async () => {
    await renderWithProviders(<LandingScreen />);
    await layOutScene(334, 330);
    const ping = screen.getByTestId('landing-ping');
    expect(ping).toHaveStyle({ borderWidth: 1, width: 108, height: 108, borderRadius: 54 });
    expect(screen.queryByTestId('landing-glow')).toBeNull();
  });

  it('numbers the grid lines that cross the scene', async () => {
    await renderWithProviders(<LandingScreen />);
    // Portrait on a 390 × 844 screen: columns at 112 and 284, rows every 172 from 112.
    await fireEvent(screen.getByTestId('landing-scene'), 'layout', { nativeEvent: { layout: { x: 28, y: 300, width: 334, height: 330 } } });
    const grid = within(screen.getByTestId('landing-grid'));
    expect(grid.getByText('70')).toBeTruthy();
    expect(grid.getByText('71')).toBeTruthy();
    // Rows at 456 and 628 cross it: from the bottom row (60) up, they are 62 and 61.
    expect(grid.getByText('62')).toBeTruthy();
    expect(grid.getByText('61')).toBeTruthy();
    expect(grid.queryByText('63')).toBeNull();
  });

  it('stacks in portrait and puts the words beside the scene in landscape', async () => {
    await renderWithProviders(<LandingScreen />);
    expect(screen.getByTestId('landing-portrait')).toBeTruthy();
    await screen.unmount();
    Object.assign(mockDims, { width: 844, height: 390 });
    await renderWithProviders(<LandingScreen />);
    const page = screen.getByTestId('landing-landscape');
    expect(page.props.className).toMatch(/\bflex-row\b/);
    expect(within(page).getByTestId('landing-title')).toBeTruthy();
    expect(within(page).getByRole('button', { name: 'Get started' })).toBeTruthy();
  });

  it('draws still contours behind everything, over the whole screen', async () => {
    await renderWithProviders(<LandingScreen />);
    const contours = screen.getByTestId('landing-contours');
    expect(contours).toHaveStyle({ width: 390, height: 844 });
    expect(contours.props.style).not.toHaveProperty('transform');
    expect(contours.props.pointerEvents).toBe('none');
  });

  it('tightens the title and features on an iPhone SE, keeping it all', async () => {
    Object.assign(mockDims, { width: 375, height: 667 });
    await renderWithProviders(<LandingScreen />);
    expect(screen.getByRole('header', { name: 'RTAP' })).toHaveStyle({ fontSize: 56 });
    expect(screen.getByLabelText('RTAP logo')).toHaveStyle({ height: 40 });
    expect(screen.getByText('MGRS grids to the meter').props.className).toContain('text-sm');
    expect(screen.getByTestId('landing-portrait').props.className).toContain('gap-4');
  });

  it('drops the feature list on a small Android, so the scene and Get started keep their room', async () => {
    Object.assign(mockDims, { width: 360, height: 592 });
    await renderWithProviders(<LandingScreen />);
    expect(screen.queryByTestId('landing-features')).toBeNull();
    expect(screen.getByRole('button', { name: 'Get started' })).toBeTruthy();
  });

  it('fits a phone on its side with a smaller title', async () => {
    Object.assign(mockDims, { width: 844, height: 390 });
    await renderWithProviders(<LandingScreen />);
    expect(screen.getByRole('header', { name: 'RTAP' })).toHaveStyle({ fontSize: 48 });
    expect(screen.getByTestId('landing-features')).toBeTruthy();
  });

  it('keeps the scene from collapsing, and scrolls rather than cutting off Get started', async () => {
    await renderWithProviders(<LandingScreen />);
    expect(screen.getByTestId('landing-scene')).toHaveStyle({ minHeight: 200 });
    expect(within(screen.getByTestId('landing-scroll')).getByRole('button', { name: 'Get started' })).toBeTruthy();
  });

  it('draws the ring and units smaller in a short scene', async () => {
    await renderWithProviders(<LandingScreen />);
    await layOutScene(334, 200);
    // Scaled to 0.67 of the design: a 36 pt ring.
    expect(screen.getByTestId('landing-ping')).toHaveStyle({ width: 72, borderRadius: 36 });
    expect(screen.getAllByTestId('skia-path').filter((p) => p.props.path.includes(' a36 36 '))).toHaveLength(2);
  });
});
