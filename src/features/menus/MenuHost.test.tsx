import { act, fireEvent, screen } from '@testing-library/react-native';

import { INITIAL_MENU, useMenu } from '@/stores/menu';
import { renderWithProviders } from '@/test-utils/render';

import { MenuHost } from './MenuHost';

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true }) }));

beforeEach(() => useMenu.setState(INITIAL_MENU));

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
    expect(useMenu.getState().panelFrame).toMatchObject({ side: 'bottom' });
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
});
