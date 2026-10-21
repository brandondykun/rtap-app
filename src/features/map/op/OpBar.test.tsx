import { fireEvent, screen } from '@testing-library/react-native';

import { INITIAL_OP, useOp } from '@/stores/op';
import { DEFAULT_SETTINGS, useSettings } from '@/stores/settings';
import { renderWithProviders } from '@/test-utils/render';

import { OpBar } from './OpBar';

beforeEach(() => {
  useSettings.setState(DEFAULT_SETTINGS);
  useOp.setState({ ...INITIAL_OP, phase: 'on', at: { lat: 38.9, lon: -77 }, eyeM: 10, bearing: 45, zoom: 1 });
});

describe('OpBar', () => {
  it('leaves the eye height to the vertical slider', async () => {
    await renderWithProviders(<OpBar onExit={jest.fn()} />);
    expect(screen.queryByText(/^Eye /)).toBeNull();
    expect(screen.queryByTestId('op-eye')).toBeNull();
  });

  it('does not show where the view faces', async () => {
    useSettings.setState({ northRef: 'grid', angleUnit: 'mil' });
    await renderWithProviders(<OpBar onExit={jest.fn()} />);
    expect(screen.queryByText(/GRID|mils/)).toBeNull();
  });

  it('shows magnification only above 1×', async () => {
    await renderWithProviders(<OpBar onExit={jest.fn()} />);
    expect(screen.queryByText('1.0×')).toBeNull();
    await screen.unmount();
    useOp.setState({ zoom: 2 });
    await renderWithProviders(<OpBar onExit={jest.fn()} />);
    expect(screen.getByText('2.0×')).toBeTruthy();
  });

  it('Exit calls onExit', async () => {
    const onExit = jest.fn();
    await renderWithProviders(<OpBar onExit={onExit} />);
    await fireEvent.press(screen.getByLabelText('Exit'));
    expect(onExit).toHaveBeenCalled();
  });
});
