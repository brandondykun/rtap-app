import { act, fireEvent, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { State } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';

import { INITIAL_OP, useOp } from '@/stores/op';
import { DEFAULT_SETTINGS, useSettings } from '@/stores/settings';
import { renderWithProviders } from '@/test-utils/render';
import { themeColors } from '@/theme/tokens';

import { EYE_TRACK_HEIGHT, EYE_TRACK_MIN, OpEyeSlider } from './OpEyeSlider';

const dragTo = (y: number) =>
  act(() => {
    fireGestureHandler(getByGestureTestId('op-eye-drag'), [{ state: State.BEGAN, y }, { state: State.ACTIVE, y }, { state: State.END, y }]);
  });

beforeEach(() => {
  useSettings.setState(DEFAULT_SETTINGS);
  useOp.setState({ ...INITIAL_OP, phase: 'on', at: { lat: 38.9, lon: -77 }, eyeM: 10 });
});

describe('OpEyeSlider', () => {
  it('labels the eye height in metres or feet', async () => {
    await renderWithProviders(<OpEyeSlider />);
    expect(screen.getByTestId('op-eye-label')).toHaveTextContent(/^10 m$/);
    await screen.unmount();
    useSettings.setState({ altitudeUnit: 'ft' });
    await renderWithProviders(<OpEyeSlider />);
    expect(screen.getByTestId('op-eye-label')).toHaveTextContent(/^33 ft$/);
  });

  it('is vertical: the top of the track is the highest eye, the bottom the lowest', async () => {
    await renderWithProviders(<OpEyeSlider />);
    await dragTo(0);
    expect(useOp.getState().eyeM).toBe(250);
    await dragTo(EYE_TRACK_HEIGHT);
    expect(useOp.getState().eyeM).toBe(5);
  });

  it('is at most EYE_TRACK_HEIGHT tall and shrinks to fit, never below the minimum: the ends follow the measured track', async () => {
    await renderWithProviders(<OpEyeSlider />);
    expect(screen.getByTestId('op-eye-slider').props.className).toContain('shrink');
    expect(screen.getByTestId('op-eye-track').props.className).toContain('shrink');
    expect(StyleSheet.flatten(screen.getByTestId('op-eye-track').props.style)).toMatchObject({ height: EYE_TRACK_HEIGHT, minHeight: EYE_TRACK_MIN });
    await fireEvent(screen.getByTestId('op-eye-track'), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 44, height: 120 } } });
    await dragTo(120);
    expect(useOp.getState().eyeM).toBe(5);
    await dragTo(60);
    expect(useOp.getState().eyeM).toBe(Math.round(5 + 245 / 2));
  });

  it('sets whole metres in between, and clamps past the ends', async () => {
    await renderWithProviders(<OpEyeSlider />);
    await dragTo(EYE_TRACK_HEIGHT / 2);
    expect(useOp.getState().eyeM).toBe(Math.round(5 + 245 / 2));
    await dragTo(-40);
    expect(useOp.getState().eyeM).toBe(250);
  });

  it('lets touches on the panel around the track through to the map', async () => {
    await renderWithProviders(<OpEyeSlider />);
    expect(screen.getByTestId('op-eye-slider')).toHaveProp('pointerEvents', 'box-none');
    expect(screen.getByTestId('op-eye-label')).toHaveProp('pointerEvents', 'none');
  });

  it('keeps one width whether the height has one, two or three digits', async () => {
    const widths = [];
    for (const eyeM of [5, 25, 250]) {
      useOp.setState({ eyeM });
      await renderWithProviders(<OpEyeSlider />);
      widths.push(StyleSheet.flatten(screen.getByTestId('op-eye-slider').props.style).width);
      await screen.unmount();
    }
    // Just wider than `820 ft`, the longest height label.
    expect(widths[0]).toBe(48);
    expect(new Set(widths).size).toBe(1);
  });

  it('sits on a see-through background so the map shows behind it', async () => {
    await renderWithProviders(<OpEyeSlider />);
    const panel = screen.getByTestId('op-eye-slider');
    expect(panel.props.className).toContain('bg-surface-glass');
    expect(panel.props.className).not.toContain('bg-surface-chrome');
    expect(themeColors('dark')['surface-glass']).toBe('rgba(10, 10, 10, 0.35)');
  });

  it('places the thumb by the eye height', async () => {
    useOp.setState({ eyeM: 250 });
    await renderWithProviders(<OpEyeSlider />);
    expect(screen.getByTestId('op-eye-thumb')).toHaveStyle({ top: 0 });
  });
});
