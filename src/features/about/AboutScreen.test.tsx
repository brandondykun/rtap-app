import Ionicons from '@expo/vector-icons/Ionicons';
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
  it('shows the identity card: amber mark, RTAP, tagline, builders and version', async () => {
    await renderWithProviders(<AboutScreen />);
    const card = screen.getByTestId('about-identity');
    expect(screen.getByText('RTAP').props.className).toContain('text-accent');
    expect(card).toHaveTextContent(/RTAP.*Realtime Team Awareness Platform.*Built by military and geospatial professionals\..*Version/);
    expect(screen.getByText(`Version ${Constants.expoConfig?.version ?? '—'}`)).toBeTruthy();
    expect(screen.getByTestId('about-mark').props.className).toContain('bg-accent');
    expect(screen.getByText(/Mapbox/)).toBeTruthy();
  });

  it('warns that it is for training and simulation only', async () => {
    await renderWithProviders(<AboutScreen />);
    expect(screen.getByTestId('about-warning')).toHaveTextContent(/Training & simulation only.*Not for real-world military use or targeting\./i);
  });

  it('opens the toolbar guide with the two ways to place anything', async () => {
    await renderWithProviders(<AboutScreen />);
    expect(screen.getByText('Toolbar guide')).toBeTruthy();
    expect(screen.getByTestId('about-tip')).toHaveTextContent(
      'Two ways to place anything: tap the map, or line up the crosshair and press CTR for precision.',
    );
    expect(screen.getByText('CTR').props.className).toContain('text-accent');
  });

  it('draws its own header: a large Back button and the About title', async () => {
    // The native iOS 26 back button flashes light as the page opens, so the app draws this header.
    await renderWithProviders(<AboutScreen />);
    expect(screen.getByRole('header', { name: 'About' })).toBeTruthy();
    const back = screen.getByLabelText('Back');
    expect(back).toHaveTextContent(/Back$/);
    // 24 pt Back label and title, a smaller thin iOS chevron, and a little room under the bar.
    expect(screen.getByText('Back').props.className).toContain('text-2xl');
    expect(screen.getByRole('header', { name: 'About' }).props.className).toContain('text-2xl');
    expect(screen.getByTestId('about-back-chevron').props.style).toEqual(expect.arrayContaining([expect.objectContaining({ fontSize: 26 })]));
    expect(screen.getByTestId('about-header').props.className).toContain('pb-2');
    expect(screen.getByTestId('about-back-chevron')).toHaveTextContent(String.fromCodePoint(Number(Ionicons.glyphMap['chevron-back'])));
    // At least the 44 pt minimum touch target.
    expect(back.props.className).toContain('min-h-11');
    expect(back.props.className).toContain('min-w-11');
    await fireEvent.press(back);
    expect(mockRouter.back).toHaveBeenCalled();
  });

  it('keeps the header below the status bar and clear of the notch', async () => {
    jest.spyOn(SafeArea, 'useSafeAreaInsets').mockReturnValue({ top: 0, right: 47, bottom: 21, left: 59 });
    await renderWithProviders(<AboutScreen />);
    let header = StyleSheet.flatten(screen.getByTestId('about-header').props.style);
    expect([header.paddingTop, header.paddingLeft, header.paddingRight]).toEqual([0, 59 + 8, 47 + 8]);
    jest.spyOn(SafeArea, 'useSafeAreaInsets').mockReturnValue({ top: 59, right: 0, bottom: 34, left: 0 });
    await screen.unmount();
    await renderWithProviders(<AboutScreen />);
    header = StyleSheet.flatten(screen.getByTestId('about-header').props.style);
    expect(header.paddingTop).toBe(59);
  });

  it('lists every toolbar button under its group, with its icon tile, name and help', async () => {
    await renderWithProviders(<AboutScreen />);
    for (const title of ['Plot on the map', 'Read the map', 'App']) expect(screen.getByText(title)).toBeTruthy();
    for (const h of TOOLBAR_HELP) {
      const row = screen.getByTestId(`help-${h.label}`);
      expect(row).toHaveTextContent(new RegExp(`${h.label}.*${h.help.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
      expect(screen.getByTestId(`help-${h.label}`).parent).toBeTruthy();
    }
    expect(screen.getByTestId('help-tile-PLOT')).toBeTruthy();
  });

  it('keeps its content inside the safe area in landscape and scrolls', async () => {
    jest.spyOn(SafeArea, 'useSafeAreaInsets').mockReturnValue({ top: 0, right: 47, bottom: 21, left: 59 });
    await renderWithProviders(<AboutScreen />);
    const content = StyleSheet.flatten(screen.getByTestId('about-scroll').props.contentContainerStyle);
    expect(content.paddingLeft).toBe(59 + 16);
    expect(content.paddingRight).toBe(47 + 16);
    expect(content.paddingBottom).toBe(21 + 24);
    // The header above already sits below the status bar, so the content does not add the top inset.
    expect(content.paddingTop).toBe(16);
  });
});
