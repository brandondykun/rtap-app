import { fireEvent, screen } from '@testing-library/react-native';
import Constants from 'expo-constants';
import { StyleSheet } from 'react-native';
import * as SafeArea from 'react-native-safe-area-context';

import { TOOLBAR_HELP } from '@/features/toolbar/toolbar-help';

import { renderWithProviders } from '@/test-utils/render';

import { AboutScreen } from './AboutScreen';

const mockRouter = { back: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));

afterEach(() => jest.restoreAllMocks());

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

  it('explains every toolbar button with its icon and name', async () => {
    await renderWithProviders(<AboutScreen />);
    expect(screen.getByText('Toolbar')).toBeTruthy();
    for (const h of TOOLBAR_HELP) {
      const row = screen.getByTestId(`help-${h.label}`);
      expect(row).toHaveTextContent(new RegExp(`${h.label}.*${h.help.slice(0, 20).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
    }
  });

  it('keeps its content inside the safe area in landscape and scrolls', async () => {
    jest.spyOn(SafeArea, 'useSafeAreaInsets').mockReturnValue({ top: 0, right: 47, bottom: 21, left: 59 });
    await renderWithProviders(<AboutScreen />);
    const content = StyleSheet.flatten(screen.getByTestId('about-scroll').props.contentContainerStyle);
    expect(content.paddingLeft).toBe(59 + 16);
    expect(content.paddingRight).toBe(47 + 16);
    expect(content.paddingBottom).toBe(21 + 24);
  });
});
