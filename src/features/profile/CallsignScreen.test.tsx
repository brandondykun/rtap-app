import { fireEvent, screen } from '@testing-library/react-native';

import { DEFAULT_PROFILE, useProfile } from '@/stores/profile';
import { renderWithProviders } from '@/test-utils/render';

import { CallsignScreen } from './CallsignScreen';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));

beforeEach(() => {
  jest.clearAllMocks();
  useProfile.setState(DEFAULT_PROFILE);
});

describe('CallsignScreen', () => {
  it('explains what the callsign is for', async () => {
    await renderWithProviders(<CallsignScreen />);
    expect(screen.getByRole('header', { name: 'Choose your callsign' })).toBeTruthy();
    expect(screen.getByTestId('callsign-explainer')).toHaveTextContent(/team will see.*change it any time in Settings/);
  });

  it('counts as answered once shown, so swiping it away does not bring it back', async () => {
    await renderWithProviders(<CallsignScreen />);
    expect(useProfile.getState().callsignPrompted).toBe(true);
  });

  it('saves a valid callsign in capitals and closes', async () => {
    await renderWithProviders(<CallsignScreen />);
    const save = screen.getByRole('button', { name: 'Save' });
    expect(save).toBeDisabled();
    expect(screen.getByTestId('callsign-rule')).toHaveTextContent('Up to 16 letters, numbers, spaces or hyphens');
    expect(screen.getByTestId('callsign-rule').props.className).not.toContain('text-danger');
    await fireEvent.changeText(screen.getByLabelText('Callsign'), 'viper_6');
    expect(screen.getByTestId('callsign-rule').props.className).toContain('text-danger');
    expect(save).toBeDisabled();
    await fireEvent.changeText(screen.getByLabelText('Callsign'), 'viper 6');
    await fireEvent.press(save);
    expect(useProfile.getState().callsign).toBe('VIPER 6');
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
  });

  it('closes with Not now and keeps the callsign as it was', async () => {
    useProfile.getState().setCallsign('HAWK');
    await renderWithProviders(<CallsignScreen />);
    expect(screen.getByLabelText('Callsign').props.value).toBe('HAWK');
    await fireEvent.changeText(screen.getByLabelText('Callsign'), 'VIPER');
    await fireEvent.press(screen.getByRole('button', { name: 'Not now' }));
    expect(useProfile.getState().callsign).toBe('HAWK');
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
  });
});
