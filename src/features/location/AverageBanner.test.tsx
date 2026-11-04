import { act, fireEvent, screen } from '@testing-library/react-native';

import { INITIAL_GPS_AVERAGE, useGpsAverage } from '@/stores/gps-average';
import { INITIAL_PRESENCE, type SelfPosition, usePresence } from '@/stores/presence';
import { useToast } from '@/stores/toast';
import { renderWithProviders } from '@/test-utils/render';

import { AverageBanner } from './AverageBanner';

const HERE = { lat: 38.9, lon: -77 };
/** About 60 m north of HERE. */
const FAR = { lat: 38.9 + 60 / 111_320, lon: -77 };
const fix = (t: number, position = HERE): SelfPosition => ({ position, accuracyM: 5, timestamp: t, altitudeM: 10 });

const PAUSED_TEXT = 'You moved — averaging paused';
const AWAY_TEXT = "You're not where you were averaging";

/** Averaging at HERE, then paused (as if moved), with the live fix in the presence store. */
function pauseAt(live: SelfPosition) {
  const g = useGpsAverage.getState();
  g.start();
  for (let i = 0; i < 5; i++) g.addFix(fix(i * 10_000), 0);
  g.pause(100_000);
  usePresence.setState({ selfPosition: live });
}

beforeEach(() => {
  useGpsAverage.setState(INITIAL_GPS_AVERAGE);
  usePresence.setState(INITIAL_PRESENCE);
  useToast.setState({ toast: null });
});

describe('AverageBanner', () => {
  it('shows nothing while averaging or off', async () => {
    await renderWithProviders(<AverageBanner />);
    expect(screen.queryByTestId('average-banner')).toBeNull();
    await act(async () => useGpsAverage.getState().start());
    expect(screen.queryByTestId('average-banner')).toBeNull();
  });

  it('paused: Resume carries on when back on the spot', async () => {
    pauseAt(fix(120_000));
    await renderWithProviders(<AverageBanner />);
    expect(screen.getByText(PAUSED_TEXT)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Resume' }));
    expect(useGpsAverage.getState().phase).toBe('averaging');
    expect(screen.queryByTestId('average-banner')).toBeNull();
  });

  it('paused: Resume elsewhere switches to the away message', async () => {
    pauseAt(fix(120_000, FAR));
    await renderWithProviders(<AverageBanner />);
    await fireEvent.press(screen.getByRole('button', { name: 'Resume' }));
    expect(useGpsAverage.getState().phase).toBe('away');
    expect(screen.getByText(AWAY_TEXT)).toBeTruthy();
  });

  it('paused: Resume with no fix since the pause, or only the average, does not carry on', async () => {
    // The last fix before the phone was carried off, on the spot but old.
    pauseAt(fix(40_000));
    await renderWithProviders(<AverageBanner />);
    await fireEvent.press(screen.getByRole('button', { name: 'Resume' }));
    expect(useGpsAverage.getState().phase).toBe('away');

    await act(async () => pauseAt({ ...fix(120_000), averaged: true }));
    await fireEvent.press(screen.getByRole('button', { name: 'Resume' }));
    expect(useGpsAverage.getState().phase).toBe('away');
  });

  it('paused: Discard turns Average mode off', async () => {
    pauseAt(fix(120_000));
    await renderWithProviders(<AverageBanner />);
    await fireEvent.press(screen.getByRole('button', { name: 'Discard' }));
    expect(useGpsAverage.getState().phase).toBe('off');
  });

  it('away: Start new average here restarts, Turn off stops', async () => {
    pauseAt(fix(120_000, FAR));
    useGpsAverage.getState().resume(fix(120_000, FAR));
    const { unmount } = await renderWithProviders(<AverageBanner />);
    await fireEvent.press(screen.getByRole('button', { name: 'Start new average here' }));
    expect(useGpsAverage.getState().phase).toBe('averaging');
    expect(useGpsAverage.getState().samples).toHaveLength(0);
    expect(useToast.getState().toast?.message).toMatch(/Keep the device still/);
    await unmount();

    pauseAt(fix(120_000, FAR));
    useGpsAverage.getState().resume(fix(120_000, FAR));
    await renderWithProviders(<AverageBanner />);
    await fireEvent.press(screen.getByRole('button', { name: 'Turn off' }));
    expect(useGpsAverage.getState().phase).toBe('off');
  });
});
