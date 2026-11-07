import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { act, fireEvent, screen } from '@testing-library/react-native';

import { INITIAL_GPS_AVERAGE, useGpsAverage } from '@/stores/gps-average';
import type { SelfPosition } from '@/stores/presence';
import { useToast } from '@/stores/toast';
import { renderWithProviders } from '@/test-utils/render';
import { themeColors } from '@/theme/tokens';

import { AverageActions, AverageHeader, formatElapsed, formatFixCount } from './AverageStatus';

const HERE = { lat: 38.9, lon: -77 };
/** About 60 m north of HERE. */
const FAR = { lat: 38.9 + 60 / 111_320, lon: -77 };
const fix = (t: number, position = HERE): SelfPosition => ({ position, accuracyM: 5, timestamp: t, altitudeM: 10 });

/** Averaged at HERE for 40 s, then paused at 100 s (as if moved), then the live fix arrives. */
function pauseAt(live: SelfPosition) {
  const g = useGpsAverage.getState();
  g.start();
  for (let i = 0; i < 5; i++) {
    g.noteLive(fix(i * 10_000));
    g.addFix(fix(i * 10_000), 0);
  }
  g.pause(100_000);
  g.noteLive(live);
}

beforeEach(() => {
  useGpsAverage.setState(INITIAL_GPS_AVERAGE);
  useToast.setState({ toast: null });
});

describe('formatElapsed', () => {
  it('reads as minutes and seconds, then whole hours past the hour', () => {
    expect(formatElapsed(0)).toBe('0:00');
    expect(formatElapsed(84.9)).toBe('1:24');
    expect(formatElapsed(725)).toBe('12:05');
    expect(formatElapsed(3599)).toBe('59:59');
    expect(formatElapsed(3600)).toBe('1hr+');
    expect(formatElapsed(7199)).toBe('1hr+');
    expect(formatElapsed(7200)).toBe('2hr+');
  });
});

describe('formatFixCount', () => {
  it('shortens to thousands past 999, then whole thousands past 9,999, rounding down', () => {
    expect(formatFixCount(0)).toBe('0');
    expect(formatFixCount(999)).toBe('999');
    expect(formatFixCount(1000)).toBe('1K');
    expect(formatFixCount(1099)).toBe('1K');
    expect(formatFixCount(1100)).toBe('1.1K');
    expect(formatFixCount(9999)).toBe('9.9K');
    expect(formatFixCount(10_000)).toBe('10K+');
    expect(formatFixCount(10_999)).toBe('10K+');
    expect(formatFixCount(11_000)).toBe('11K+');
  });
});

describe('AverageHeader', () => {
  it('shows nothing while Average mode is off', async () => {
    await renderWithProviders(<AverageHeader inline={false} />);
    expect(screen.queryByTestId('average-header')).toBeNull();
  });

  it('averaging: a blinking dot, hold still, and the fixes so far', async () => {
    const g = useGpsAverage.getState();
    g.start();
    for (let i = 0; i <= 84; i++) g.addFix(fix(i * 1000), 0);
    await renderWithProviders(<AverageHeader inline={false} />);
    expect(screen.getByTestId('average-blink')).toBeTruthy();
    expect(screen.getByTestId('average-header')).toHaveTextContent(/AVERAGE MODE.*hold still/);
    expect(screen.getByTestId('average-detail')).toHaveTextContent(/· 85 fixes$/);
  });

  it('times averaging like a stopwatch: from the tap, every second, stopped while paused, carried on by Resume', async () => {
    jest.useFakeTimers({ now: 1_000_000 });
    try {
      useGpsAverage.getState().start();
      await renderWithProviders(<AverageHeader inline={false} />);
      await act(async () => jest.advanceTimersByTime(0));
      expect(screen.getByTestId('average-detail')).toHaveTextContent('0:00 · 0 fixes');
      // No fixes needed: it is the time since the tap.
      await act(async () => jest.advanceTimersByTime(59_000));
      expect(screen.getByTestId('average-detail')).toHaveTextContent('0:59 · 0 fixes');
      await act(async () => jest.advanceTimersByTime(1000));
      expect(screen.getByTestId('average-detail')).toHaveTextContent('1:00 · 0 fixes');

      // Paused half a second later, for ten minutes: none of it counts.
      await act(async () => jest.advanceTimersByTime(500));
      await act(async () => useGpsAverage.getState().pause(0));
      expect(useGpsAverage.getState().elapsedMs).toBe(60_500);
      await act(async () => jest.advanceTimersByTime(600_000));
      expect(useGpsAverage.getState().elapsedMs).toBe(60_500);
      // Resume carries on from 1:00.5.
      await act(async () => useGpsAverage.getState().resume());
      await act(async () => jest.advanceTimersByTime(0));
      expect(screen.getByTestId('average-detail')).toHaveTextContent('1:00 · 0 fixes');
      await act(async () => jest.advanceTimersByTime(30_000));
      expect(screen.getByTestId('average-detail')).toHaveTextContent('1:30 · 0 fixes');
    } finally {
      jest.useRealTimers();
    }
  });

  it('the fix count switches the fixes on the map, with an eye that says which way', async () => {
    useGpsAverage.getState().start();
    await renderWithProviders(<AverageHeader inline={false} />);
    const eye = (name: string) => String.fromCodePoint(Number(MaterialCommunityIcons.glyphMap[name as keyof typeof MaterialCommunityIcons.glyphMap]));
    expect(screen.getByTestId('average-fixes-toggle')).toHaveTextContent(new RegExp(eye('eye-off-outline')));
    await fireEvent.press(screen.getByRole('button', { name: /^Show fixes on map, 0:00 · 0 fixes$/ }));
    expect(useGpsAverage.getState().showFixes).toBe(true);
    expect(screen.getByTestId('average-fixes-toggle')).toHaveTextContent(new RegExp(eye('eye-outline')));
    expect(screen.getByRole('button', { name: /^Hide fixes on map/ })).toBeSelected();
    await fireEvent.press(screen.getByRole('button', { name: /^Hide fixes on map/ }));
    expect(useGpsAverage.getState().showFixes).toBe(false);
  });

  it('minimal drops the time and count', async () => {
    useGpsAverage.getState().start();
    await renderWithProviders(<AverageHeader inline minimal />);
    expect(screen.getByTestId('average-header')).toBeTruthy();
    expect(screen.queryByTestId('average-detail')).toBeNull();
    expect(screen.queryByTestId('average-fixes-toggle')).toBeNull();
  });

  it('paused: how far the live fix is from the held average, as a distance, and the fixes kept', async () => {
    pauseAt(fix(120_000, FAR));
    await renderWithProviders(<AverageHeader inline={false} />);
    expect(screen.getByTestId('average-header')).toHaveTextContent(/PAUSED.*you moved 60 m/);
    expect(screen.getByTestId('average-distance')).toHaveStyle({ color: themeColors('dark')['value-distance'] });
    expect(screen.getByTestId('average-detail')).toHaveTextContent('5 fixes kept');
    expect(screen.queryByTestId('average-blink')).toBeNull();
  });

  it('paused from AVG: asks for Resume or Stop, not that the user moved', async () => {
    useGpsAverage.getState().start();
    for (let i = 0; i < 5; i++) useGpsAverage.getState().addFix(fix(i * 10_000), 0);
    useGpsAverage.getState().pauseByUser();
    await renderWithProviders(<AverageHeader inline={false} />);
    expect(screen.getByTestId('average-header')).toHaveTextContent(/PAUSED.*Resume or Stop/);
    expect(screen.getByTestId('average-header')).not.toHaveTextContent(/moved/);
  });

  it('paused: no distance until a fix since the pause says where the user is', async () => {
    pauseAt(fix(40_000));
    await renderWithProviders(<AverageHeader inline={false} />);
    expect(screen.getByTestId('average-header')).toHaveTextContent(/you moved\W*5 fixes kept/);
    expect(screen.queryByTestId('average-distance')).toBeNull();
  });
});

describe('AverageActions', () => {
  it('shows nothing while averaging or off', async () => {
    await renderWithProviders(<AverageActions inline={false} />);
    expect(screen.queryByTestId('average-actions')).toBeNull();
    await act(async () => useGpsAverage.getState().start());
    expect(screen.queryByTestId('average-actions')).toBeNull();
  });

  it('paused: Resume carries on, even where the GPS says the user moved off the spot', async () => {
    pauseAt(fix(120_000, FAR));
    await renderWithProviders(<AverageActions inline={false} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Resume' }));
    expect(useGpsAverage.getState().phase).toBe('averaging');
    expect(screen.queryByTestId('average-actions')).toBeNull();
  });

  it('paused: Stop turns Average mode off', async () => {
    pauseAt(fix(120_000));
    await renderWithProviders(<AverageActions inline={false} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Stop' }));
    expect(useGpsAverage.getState().phase).toBe('off');
  });

});
