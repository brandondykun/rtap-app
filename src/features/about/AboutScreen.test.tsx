import Ionicons from '@expo/vector-icons/Ionicons';
import { fireEvent, screen } from '@testing-library/react-native';
import Constants from 'expo-constants';
import { Linking, ScrollView, StyleSheet } from 'react-native';
import * as SafeArea from 'react-native-safe-area-context';

import { SETTINGS_HELP } from '@/features/menus/menus/settings-help';
import { AVERAGE_HELP } from '@/features/location/average-help';
import { OVERLAYS_HELP } from '@/features/overlays/overlays-help';
import { TOOLBAR_HELP } from '@/features/toolbar/toolbar-help';

import { renderWithProviders } from '@/test-utils/render';
import { themeColors } from '@/theme/tokens';
import { VALUE_COLOR_GUIDE } from '@/theme/value-colors';

import { ITEMS_HELP, MAP_HELP, MISSIONS_HELP } from './about-help';
import { ABOUT_CONTENTS, AboutScreen } from './AboutScreen';


const mockRouter = { back: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));

afterEach(() => jest.restoreAllMocks());

describe('AboutScreen', () => {
  it('lists every section at the top, in page order, and a tap scrolls to it', async () => {
    const scrollTo = jest.spyOn(ScrollView.prototype, 'scrollTo').mockImplementation(() => {});
    await renderWithProviders(<AboutScreen />);
    const titles = ABOUT_CONTENTS.map((c) => c.title);
    const shown = screen.getAllByRole('header').map((h) => h.props.children).filter((t) => titles.includes(t));
    expect(shown).toEqual(titles);
    // Each section's title row and its layout box share the title text's parent.
    let section = screen.getByRole('header', { name: 'Missions' });
    while (!section.props.onLayout) section = section.parent!;
    await fireEvent(section, 'layout', { nativeEvent: { layout: { x: 0, y: 1234, width: 300, height: 200 } } });
    await fireEvent.press(screen.getByTestId('contents-missions'));
    expect(scrollTo).toHaveBeenCalledWith({ y: 1234, animated: true });
  });

  it('explains the map screen, working with items and missions', async () => {
    await renderWithProviders(<AboutScreen />);
    for (const name of ['The map screen', 'Working with items', 'Missions']) expect(screen.getByRole('header', { name })).toBeTruthy();
    for (const [prefix, items] of [['map-help', MAP_HELP], ['items-help', ITEMS_HELP], ['missions-help', MISSIONS_HELP]] as const) {
      for (const h of items) expect(screen.getByTestId(`${prefix}-${h.title}`)).toHaveTextContent(h.help, { exact: false });
    }
  });

  it('explains overlays: what they are, Base, showing and hiding, adding items, managing them', async () => {
    await renderWithProviders(<AboutScreen />);
    expect(screen.getByRole('header', { name: 'Overlays' })).toBeTruthy();
    for (const h of OVERLAYS_HELP) expect(screen.getByTestId(`overlay-help-${h.title}`)).toHaveTextContent(h.help, { exact: false });
  });

  it('explains Average mode: what it does, how long, the display, moving, the fixes and its orange', async () => {
    await renderWithProviders(<AboutScreen />);
    // The section title, its contents row and the color guide's orange row.
    expect(screen.getByRole('header', { name: 'Average mode' })).toBeTruthy();
    expect(screen.getAllByText('Average mode')).toHaveLength(3);
    expect(screen.getByTestId('about-average')).toBeTruthy();
    expect(AVERAGE_HELP).toHaveLength(6);
    for (const h of AVERAGE_HELP) expect(screen.getByTestId(`average-help-${h.title}`)).toHaveTextContent(h.help, { exact: false });
  });

  it('explains the value colors, each sample drawn in its own color', async () => {
    await renderWithProviders(<AboutScreen />);
    expect(screen.getByRole('header', { name: 'Reading the colors' })).toBeTruthy();
    const colors = themeColors('dark');
    for (const g of VALUE_COLOR_GUIDE) {
      expect(screen.getByTestId(`color-help-${g.name}`)).toHaveTextContent(g.help, { exact: false });
      expect(screen.getByTestId(`color-sample-${g.name}`)).toHaveStyle({ color: colors[g.token] });
    }
    // The guide's colors are the ones the readouts use.
    expect(VALUE_COLOR_GUIDE.map((g) => g.token)).toEqual(['friendly', 'text', 'value-distance', 'value-bearing', 'value-altitude', 'value-accuracy', 'averaged']);
  });

  it('shows the identity card: amber mark, RTAP, tagline, builders and version', async () => {
    await renderWithProviders(<AboutScreen />);
    const card = screen.getByTestId('about-identity');
    expect(screen.getByText('RTAP').props.className).toContain('text-accent');
    expect(card).toHaveTextContent(/RTAP.*Realtime Team Awareness Platform.*Built by military and geospatial professionals\..*Version/);
    expect(screen.getByText(`Version ${Constants.expoConfig?.version ?? '—'}`)).toBeTruthy();
    // Which code the phone runs: what shipped in the store build, or an over-the-air update.
    expect(screen.getByTestId('about-update')).toHaveTextContent(/built-in|update /);
    // The real app icon, not a stand-in glyph.
    expect(screen.getByTestId('about-app-icon').props.source).toBeTruthy();
    expect(screen.queryByTestId('about-mark')).toBeNull();
    expect(screen.getByText(/Mapbox/)).toBeTruthy();
  });

  it('credits Eratas Software LLC at the bottom, above the map and symbol credits', async () => {
    await renderWithProviders(<AboutScreen />);
    expect(screen.getByTestId('about-built-by')).toHaveTextContent('Built by Eratas Software LLC');
    expect(screen.getByTestId('about-identity')).not.toHaveTextContent(/Eratas/);
  });

  it('opens eratas.dev in the browser from the link under the credit', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    await renderWithProviders(<AboutScreen />);
    const link = screen.getByRole('link', { name: 'eratas.dev, opens in your browser' });
    expect(link).toHaveTextContent(/^eratas\.dev/);
    await fireEvent.press(link);
    expect(open).toHaveBeenCalledWith('https://eratas.dev');
  });

  it('warns that it is for training and simulation only', async () => {
    await renderWithProviders(<AboutScreen />);
    expect(screen.getByTestId('about-warning')).toHaveTextContent(/Training & simulation only.*Not for real-world military use or targeting\./i);
  });

  it('opens the toolbar guide with the two ways to place anything', async () => {
    await renderWithProviders(<AboutScreen />);
    expect(screen.getByRole('header', { name: 'Toolbar guide' })).toBeTruthy();
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
    // Every tile icon uses the same color (PLOT is no longer amber).
    const plotIcon = screen.getByTestId('help-icon-PLOT');
    const unitIcon = screen.getByTestId('help-icon-UNIT');
    expect(StyleSheet.flatten(plotIcon.props.style).color).toBe(StyleSheet.flatten(unitIcon.props.style).color);
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

  it('explains every setting after the toolbar guide: its name, choices and what it does', async () => {
    await renderWithProviders(<AboutScreen />);
    expect(screen.getByRole('header', { name: 'Settings guide' })).toBeTruthy();
    for (const h of SETTINGS_HELP) {
      const row = screen.getByTestId(`setting-help-${h.name}`);
      expect(row).toHaveTextContent(h.name, { exact: false });
      expect(row).toHaveTextContent(h.help, { exact: false });
      if (h.choices) expect(row).toHaveTextContent(h.choices, { exact: false });
    }
    const headers = screen.getAllByRole('header').map((el) => el.props.children as string);
    expect(headers.indexOf('Settings guide')).toBeGreaterThan(headers.indexOf('App'));
  });
});
