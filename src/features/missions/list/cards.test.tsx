import { fireEvent, screen, within } from '@testing-library/react-native';

import { renderWithProviders } from '@/test-utils/render';

import type { MissionSummary } from '../repository';
import { snapshotFile } from '../snapshot-files';
import { MissionCard } from './MissionCard';
import { MissionThumb } from './MissionThumb';
import { PinnedMissionCard } from './PinnedMissionCard';

const NOW = 1_000_000_000;
const camera = { center: { lat: 38.8977, lon: -77.0365 }, zoom: 12, bearing: 0 };
const mission = (over: Partial<MissionSummary> = {}): MissionSummary => ({
  id: 'm1',
  name: 'FTIG',
  createdAt: 0,
  lastOpenedAt: NOW - 13 * 3_600_000,
  camera,
  snapshot: { uri: 'file:///docs/mission-snapshots/m1.jpg', takenAt: 7 },
  ...over,
});
const counts = { units: 6, points: 3, lines: 3, polygons: 1 };
const handlers = () => ({ onOpen: jest.fn(), onRename: jest.fn(), onDelete: jest.fn(), onOpenActions: jest.fn() });

// See MissionsScreen.test: the swipeable's worklet warning only appears under Jest.
const consoleError = console.error;
beforeAll(() => {
  jest.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    if (typeof args[0] === 'string' && args[0].includes('Some of the callbacks in the gesture are worklets')) return;
    consoleError(...args);
  });
});

describe('MissionCard', () => {
  it('shows the picture, opened time with grid square, and counts', async () => {
    const h = handlers();
    await renderWithProviders(<MissionCard mission={mission()} counts={counts} now={NOW} {...h} />);
    expect(screen.getByText('FTIG')).toBeTruthy();
    expect(screen.getByText('Opened 13 h ago · 18S UJ')).toBeTruthy();
    expect(screen.getByLabelText('6 units · 3 points · 3 lines · 1 polygon')).toBeTruthy();
    expect(screen.getByTestId('mission-thumb')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Open FTIG'));
    expect(h.onOpen).toHaveBeenCalled();
  });

  it('shows the placeholder and the empty line for a never-opened empty mission', async () => {
    await renderWithProviders(
      <MissionCard mission={mission({ lastOpenedAt: null, camera: null, snapshot: null })} counts={{ units: 0, points: 0, lines: 0, polygons: 0 }} now={NOW} {...handlers()} />,
    );
    expect(screen.getByText('Never opened')).toBeTruthy();
    expect(screen.getByText('Empty — nothing plotted yet')).toBeTruthy();
    expect(screen.getByTestId('mission-thumb-placeholder')).toBeTruthy();
  });

  it('offers Rename and Delete as accessibility actions and swipe buttons', async () => {
    const h = handlers();
    await renderWithProviders(<MissionCard mission={mission()} counts={counts} now={NOW} {...h} />);
    await fireEvent(screen.getByLabelText('Open FTIG'), 'accessibilityAction', { nativeEvent: { actionName: 'delete' } });
    expect(h.onDelete).toHaveBeenCalled();
    await fireEvent.press(screen.getByLabelText('Edit FTIG'));
    expect(h.onRename).toHaveBeenCalled();
  });

  it('sits the card on an opaque backing, so Delete never shows through it as it dims under a press', async () => {
    await renderWithProviders(<MissionCard mission={mission()} counts={counts} now={NOW} {...handlers()} />);
    const backing = screen.getByTestId('mission-card-backing');
    expect(backing.props.className).toMatch(/\bbg-surface\b/);
    expect(within(backing).getByLabelText('Open FTIG').props.className).toContain('active:opacity-60');
  });
});

describe('PinnedMissionCard', () => {
  it('shows LAST OPENED, the grid square, Resume and the four stats', async () => {
    const h = handlers();
    await renderWithProviders(<PinnedMissionCard mission={mission({ name: 'Mission 1', lastOpenedAt: NOW - 60_000 })} counts={counts} now={NOW} {...h} />);
    expect(screen.getByText('Last opened')).toBeTruthy();
    expect(screen.getByText('18S UJ')).toBeTruthy();
    expect(screen.getByText('Opened 1 min ago')).toBeTruthy();
    for (const label of ['UNITS', 'POINTS', 'LINES', 'POLYGONS']) expect(screen.getByText(label)).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Resume Mission 1'));
    expect(h.onOpen).toHaveBeenCalled();
  });

  it('hides the grid square without a saved camera', async () => {
    await renderWithProviders(<PinnedMissionCard mission={mission({ camera: null })} counts={counts} now={NOW} {...handlers()} />);
    expect(screen.queryByText('18S UJ')).toBeNull();
  });
});

describe('MissionThumb', () => {
  it('renders from the picture path built from the mission and when it was taken, not the stored absolute uri', async () => {
    // An app update or reinstall can move the iOS container: the stored path goes stale.
    const snapshot = { uri: 'file:///var/old-container/Documents/mission-snapshots/m1.jpg', takenAt: 7 };
    await renderWithProviders(<MissionThumb missionId="m1" snapshot={snapshot} className="h-10 w-10" iconSize={16} />);
    // expo-image hands the native view an array of sources.
    expect([screen.getByTestId('mission-thumb').props.source].flat()[0]).toMatchObject({ uri: snapshotFile('m1', 7).uri });
    expect(snapshotFile('m1', 7).uri).toMatch(/mission-snapshots\/m1-7\.jpg$/);
  });

  it('falls back to the placeholder when the picture fails to load', async () => {
    await renderWithProviders(<MissionThumb missionId="m1" snapshot={{ uri: 'file:///x.jpg', takenAt: 7 }} className="h-10 w-10" iconSize={16} />);
    await fireEvent(screen.getByTestId('mission-thumb'), 'error', { nativeEvent: { error: 'missing' } });
    expect(screen.queryByTestId('mission-thumb')).toBeNull();
    expect(screen.getByTestId('mission-thumb-placeholder')).toBeTruthy();
  });
});
