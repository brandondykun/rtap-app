import { act, screen } from '@testing-library/react-native';

import { INITIAL_OP, useOp } from '@/stores/op';
import { renderWithProviders } from '@/test-utils/render';

import { COMPASS_WIDTH, markX, OpCompass } from './OpCompass';

const CENTER = COMPASS_WIDTH / 2;

beforeEach(() => {
  useOp.setState({ ...INITIAL_OP, phase: 'on', at: { lat: 38.9, lon: -77 }, bearing: 0 });
});

describe('markX', () => {
  it('puts the direction being faced under the center caret', () => {
    expect(markX(0, 0)).toBe(CENTER);
    expect(markX(90, 90)).toBe(CENTER);
  });

  it('puts east to the right while facing north, and slides it left as the view turns right', () => {
    expect(markX(90, 80)).toBeGreaterThan(CENTER);
    expect(markX(90, 85)).toBeLessThan(markX(90, 80));
  });

  it('is wide: 300 points showing 120° of horizon', () => {
    expect(COMPASS_WIDTH).toBe(300);
    expect(markX(45, 0)).toBe(CENTER + 45 * (300 / 120));
  });

  it('wraps past north (at 350° the 360° north mark is right of center)', () => {
    expect(markX(360, 350)).toBeGreaterThan(CENTER);
    expect(markX(360, 350)).toBeLessThan(COMPASS_WIDTH);
  });
});

describe('OpCompass', () => {
  it('draws the tape with the caret, and north on both sides of the wrap', async () => {
    await renderWithProviders(<OpCompass top={0} />);
    expect(screen.getByTestId('compass-marker')).toBeTruthy();
    expect(screen.getAllByTestId('compass-label-N')).toHaveLength(2);
    expect(screen.getAllByTestId('compass-label-E').length).toBeGreaterThan(0);
  });

  it('does not redraw the marks while turning', async () => {
    await renderWithProviders(<OpCompass top={0} />);
    const first = screen.getAllByTestId('compass-label-E')[0];
    await act(async () => useOp.setState({ bearing: 90 }));
    expect(screen.getAllByTestId('compass-label-E')[0]).toBe(first);
  });

  it('shows no number', async () => {
    useOp.setState({ bearing: 78 });
    await renderWithProviders(<OpCompass top={0} />);
    expect(screen.queryByText(/\d/)).toBeNull();
  });

  it('shows nothing outside OP mode', async () => {
    useOp.setState(INITIAL_OP);
    await renderWithProviders(<OpCompass top={0} />);
    expect(screen.queryByTestId('op-compass')).toBeNull();
  });
});
