import { act, fireEvent, screen } from '@testing-library/react-native';

import { EDGE, GAP, HINT_BAR_HEIGHT } from '@/features/map/layout';
import { INITIAL_DRAFT, useDraft } from '@/stores/draft';
import { INITIAL_MENU, useMenu } from '@/stores/menu';
import { renderWithProviders } from '@/test-utils/render';

import { MenuHost, menuTopReserved } from './MenuHost';

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true }) }));

beforeEach(() => {
  useMenu.setState(INITIAL_MENU);
  useDraft.setState(INITIAL_DRAFT);
});

describe('MenuHost', () => {
  it('renders nothing without a menu', async () => {
    await renderWithProviders(<MenuHost landscape={false} missionId="m1" />);
    expect(screen.queryByTestId('menu-panel')).toBeNull();
  });

  it('shows the top menu in the panel and publishes the frame', async () => {
    await renderWithProviders(<MenuHost landscape={false} missionId="m1" />);
    await act(async () => useMenu.getState().openMenu('app.root', {}));
    expect(screen.getByTestId('menu-panel')).toBeTruthy();
    expect(screen.getByText('Switch mission')).toBeTruthy();
    // The sheet opens once it knows how tall its pinned header and content are.
    await fireEvent(screen.getByTestId('menu-panel-header'), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 52 } } });
    await fireEvent(screen.getByTestId('menu-panel-content'), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 200 } } });
    expect(useMenu.getState().panelFrame).toMatchObject({ side: 'bottom' });
  });

  it('while a line or polygon is being edited in portrait, a full sheet leaves room for the Tap map bar under the toolbar', () => {
    const base = menuTopReserved({ insetTop: 47, toolbar: 46, drawing: false, landscape: false });
    expect(base).toBe(47 + EDGE + 46 + GAP);
    expect(menuTopReserved({ insetTop: 47, toolbar: 46, drawing: true, landscape: false })).toBe(base + HINT_BAR_HEIGHT + EDGE);
    // A landscape drawer is beside the bar, not under it.
    expect(menuTopReserved({ insetTop: 47, toolbar: 46, drawing: true, landscape: true })).toBe(base);
  });

  it('clears the frame when the menu closes', async () => {
    await renderWithProviders(<MenuHost landscape={false} missionId="m1" />);
    await act(async () => useMenu.getState().openMenu('app.root', {}));
    await act(async () => useMenu.getState().closeMenu());
    expect(screen.queryByTestId('menu-panel')).toBeNull();
    expect(useMenu.getState().panelFrame).toBeNull();
  });

  it('minimizes the landscape drawer with its tab and reopens it for the next menu', async () => {
    await renderWithProviders(<MenuHost landscape missionId="m1" />);
    await act(async () => useMenu.getState().openMenu('app.root', {}));
    await fireEvent.press(screen.getByLabelText('Hide menu'));
    expect(useMenu.getState().panelMinimized).toBe(true);
    expect(useMenu.getState().panelFrame).toBeNull();
    // Nothing happened to the menu itself.
    expect(useMenu.getState().stack.map((e) => e.id)).toEqual(['app.root']);
    expect(screen.getByText('Switch mission', { includeHiddenElements: true })).toBeTruthy();
    await act(async () => useMenu.getState().openMenu('settings', {}));
    expect(useMenu.getState().panelMinimized).toBe(false);
    expect(useMenu.getState().panelFrame).toMatchObject({ side: 'left' });
  });

  it('tells the minimized button what the open menu is working on', async () => {
    await renderWithProviders(<MenuHost landscape missionId="m1" />);
    await act(async () => {
      useMenu.getState().openMenu('layers', {});
      useMenu.getState().setPanelMinimized(true);
    });
    expect(screen.getByLabelText('Show Layers')).toHaveTextContent(/LAYERS/);
  });
});
