import { fireEvent, screen } from '@testing-library/react-native';
import Constants from 'expo-constants';

import { renderWithProviders } from '@/test-utils/render';

import { AboutScreen } from './AboutScreen';

const mockRouter = { back: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));

describe('AboutScreen', () => {
  it('shows the app name, version and attribution, and goes back', async () => {
    await renderWithProviders(<AboutScreen />);
    expect(screen.getByText('RTAP')).toBeTruthy();
    expect(screen.getByText('Realtime Team Awareness Platform')).toBeTruthy();
    expect(screen.getByText(`Version ${Constants.expoConfig?.version ?? '—'}`)).toBeTruthy();
    expect(screen.getByText(/Mapbox/)).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Back'));
    expect(mockRouter.back).toHaveBeenCalled();
  });
});
