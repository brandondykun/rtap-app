import { act, screen } from '@testing-library/react-native';
import { State } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';

import { INITIAL_OP, useOp } from '@/stores/op';
import { DEFAULT_SETTINGS, useSettings } from '@/stores/settings';
import { renderWithProviders } from '@/test-utils/render';

import { EYE_TRACK_HEIGHT, OpEyeSlider } from './OpEyeSlider';

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
    expect(screen.getByText('Eye 10 m')).toBeTruthy();
    await screen.unmount();
    useSettings.setState({ altitudeUnit: 'ft' });
    await renderWithProviders(<OpEyeSlider />);
    expect(screen.getByText('Eye 33 ft')).toBeTruthy();
  });

  it('is vertical: the top of the track is the highest eye, the bottom the lowest', async () => {
    await renderWithProviders(<OpEyeSlider />);
    await dragTo(0);
    expect(useOp.getState().eyeM).toBe(250);
    await dragTo(EYE_TRACK_HEIGHT);
    expect(useOp.getState().eyeM).toBe(5);
  });

  it('sets whole metres in between, and clamps past the ends', async () => {
    await renderWithProviders(<OpEyeSlider />);
    await dragTo(EYE_TRACK_HEIGHT / 2);
    expect(useOp.getState().eyeM).toBe(Math.round(5 + 245 / 2));
    await dragTo(-40);
    expect(useOp.getState().eyeM).toBe(250);
  });

  it('shows no magnification', async () => {
    useOp.setState({ zoom: 2 });
    await renderWithProviders(<OpEyeSlider />);
    expect(screen.queryByText(/×/)).toBeNull();
  });

  it('places the thumb by the eye height', async () => {
    useOp.setState({ eyeM: 250 });
    await renderWithProviders(<OpEyeSlider />);
    expect(screen.getByTestId('op-eye-thumb')).toHaveStyle({ top: 0 });
  });
});
