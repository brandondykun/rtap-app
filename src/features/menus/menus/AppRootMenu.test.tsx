import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { INITIAL_MENU, useMenu } from '@/stores/menu';
import { renderWithProviders } from '@/test-utils/render';

import { AppRootMenu } from './AppRootMenu';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));

beforeEach(() => {
  jest.clearAllMocks();
  useMenu.setState(INITIAL_MENU);
  useMenu.getState().openMenu('app.root', {});
});

describe('AppRootMenu', () => {
  it('switches mission by going back to the list, leaving the menu open for the picture', async () => {
    // The router acts after the next render: closing first would slide the map back to full width
    // and drop the panel before the leaving picture is cropped. The mission screen closes the menu
    // as it unmounts.
    await renderWithProviders(<AppRootMenu params={{}} missionId="m1" />);
    await fireEvent.press(screen.getByText('Switch mission'));
    await waitFor(() => expect(mockRouter.back).toHaveBeenCalled());
    expect(useMenu.getState().stack.map((e) => e.id)).toEqual(['app.root']);
  });

  it('leaves the picture to the mission screen (beforeRemove) so it is taken once', async () => {
    await renderWithProviders(<AppRootMenu params={{}} missionId="m1" />);
    await fireEvent.press(screen.getByText('Switch mission'));
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
  });

  it('replaces to the list when there is no history', async () => {
    mockRouter.canGoBack.mockReturnValueOnce(false);
    await renderWithProviders(<AppRootMenu params={{}} missionId="m1" />);
    await fireEvent.press(screen.getByText('Switch mission'));
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/'));
  });

  it('opens the About page', async () => {
    await renderWithProviders(<AppRootMenu params={{}} missionId="m1" />);
    await fireEvent.press(screen.getByText('About'));
    expect(useMenu.getState().stack).toEqual([]);
    expect(mockRouter.push).toHaveBeenCalledWith('/about');
  });
});
