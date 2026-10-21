import { fireEvent, screen } from '@testing-library/react-native';

import { INITIAL_OP, useOp } from '@/stores/op';
import { DEFAULT_SETTINGS, useSettings } from '@/stores/settings';
import { renderWithProviders } from '@/test-utils/render';

import { OpBar } from './OpBar';

jest.mock('@expo/ui', () => {
  const { Pressable: P, View } = jest.requireActual('react-native');
  return {
    Host: ({ children }: { children: React.ReactNode }) => <View>{children}</View>,
    Slider: ({ onValueChange, testID }: { onValueChange: (v: number) => void; testID?: string }) => <P testID={testID} onPress={() => onValueChange(25)} />,
  };
});

beforeEach(() => {
  useSettings.setState(DEFAULT_SETTINGS);
  useOp.setState({ ...INITIAL_OP, phase: 'on', at: { lat: 38.9, lon: -77 }, eyeM: 10, bearing: 45, zoom: 1 });
});

describe('OpBar', () => {
  it('shows eye height in metres or feet', async () => {
    await renderWithProviders(<OpBar onExit={jest.fn()} />);
    expect(screen.getByText('Eye 10 m')).toBeTruthy();
    await screen.unmount();
    useSettings.setState({ altitudeUnit: 'ft' });
    await renderWithProviders(<OpBar onExit={jest.fn()} />);
    expect(screen.getByText('Eye 33 ft')).toBeTruthy();
  });

  it("shows where the view faces in the user's unit and north", async () => {
    useSettings.setState({ northRef: 'true', angleUnit: 'deg' });
    await renderWithProviders(<OpBar onExit={jest.fn()} />);
    expect(screen.getByText('045° TRUE')).toBeTruthy();
    await screen.unmount();
    useSettings.setState({ angleUnit: 'mil' });
    await renderWithProviders(<OpBar onExit={jest.fn()} />);
    expect(screen.getByText(/^0800 mils TRUE$/)).toBeTruthy();
  });

  it('shows magnification only above 1×', async () => {
    await renderWithProviders(<OpBar onExit={jest.fn()} />);
    expect(screen.queryByText('1.0×')).toBeNull();
    await screen.unmount();
    useOp.setState({ zoom: 2 });
    await renderWithProviders(<OpBar onExit={jest.fn()} />);
    expect(screen.getByText('2.0×')).toBeTruthy();
  });

  it('the slider sets the eye height', async () => {
    await renderWithProviders(<OpBar onExit={jest.fn()} />);
    await fireEvent.press(screen.getByTestId('op-eye'));
    expect(useOp.getState().eyeM).toBe(25);
  });

  it('Exit calls onExit', async () => {
    const onExit = jest.fn();
    await renderWithProviders(<OpBar onExit={onExit} />);
    await fireEvent.press(screen.getByLabelText('Exit'));
    expect(onExit).toHaveBeenCalled();
  });
});
