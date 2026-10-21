import { act, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { INITIAL_OP, useOp } from '@/stores/op';
import { renderWithProviders } from '@/test-utils/render';

import { COMPASS_WIDTH, OpCompass } from './OpCompass';

const leftOf = (id: string) => StyleSheet.flatten(screen.getByTestId(id).props.style).left as number;
const CENTER = COMPASS_WIDTH / 2;

beforeEach(() => {
  useOp.setState({ ...INITIAL_OP, phase: 'on', at: { lat: 38.9, lon: -77 }, bearing: 0 });
});

describe('OpCompass', () => {
  it('puts the direction being faced under the center marker', async () => {
    await renderWithProviders(<OpCompass top={0} />);
    expect(screen.getByTestId('compass-marker')).toBeTruthy();
    expect(leftOf('compass-label-N')).toBe(CENTER);
    await act(async () => useOp.setState({ bearing: 90 }));
    expect(leftOf('compass-label-E')).toBe(CENTER);
  });

  it('slides the tape the other way as the view turns right', async () => {
    useOp.setState({ bearing: 80 });
    await renderWithProviders(<OpCompass top={0} />);
    const before = leftOf('compass-label-E');
    expect(before).toBeGreaterThan(CENTER);
    await act(async () => useOp.setState({ bearing: 85 }));
    expect(leftOf('compass-label-E')).toBeLessThan(before);
  });

  it('wraps past north (350° shows N to the right of center)', async () => {
    useOp.setState({ bearing: 350 });
    await renderWithProviders(<OpCompass top={0} />);
    expect(leftOf('compass-label-N')).toBeGreaterThan(CENTER);
    expect(screen.queryByTestId('compass-label-S')).toBeNull();
  });

  it('shows no number', async () => {
    useOp.setState({ bearing: 78 });
    await renderWithProviders(<OpCompass top={0} />);
    expect(screen.queryByText(/\d/)).toBeNull();
  });

  it('is wide: 300 points showing 120° of horizon', async () => {
    expect(COMPASS_WIDTH).toBe(300);
    useOp.setState({ bearing: 0 });
    await renderWithProviders(<OpCompass top={0} />);
    expect(leftOf('compass-label-NE')).toBe(CENTER + 45 * (300 / 120));
  });

  it('shows nothing outside OP mode', async () => {
    useOp.setState(INITIAL_OP);
    await renderWithProviders(<OpCompass top={0} />);
    expect(screen.queryByTestId('op-compass')).toBeNull();
  });
});
