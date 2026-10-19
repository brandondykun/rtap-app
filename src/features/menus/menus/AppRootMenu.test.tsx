import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { INITIAL_MENU, useMenu } from '@/stores/menu';
import { renderWithProviders } from '@/test-utils/render';

import { AppRootMenu } from './AppRootMenu';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));
const mockCapture = jest.fn(async () => undefined);
jest.mock('@/features/map/canvas/mission-snapshot', () => ({ captureBeforeLeave: () => mockCapture() }));

beforeEach(() => {
  jest.clearAllMocks();
  useMenu.setState(INITIAL_MENU);
  useMenu.getState().openMenu('app.root', {});
});

describe('AppRootMenu', () => {
  it('switches mission by going back to the list', async () => {
    await renderWithProviders(<AppRootMenu params={{}} missionId="m1" />);
    await fireEvent.press(screen.getByText('Switch mission'));
    expect(useMenu.getState().stack).toEqual([]);
    await waitFor(() => expect(mockRouter.back).toHaveBeenCalled());
  });

  it('captures the map picture before switching mission', async () => {
    await renderWithProviders(<AppRootMenu params={{}} missionId="m1" />);
    await fireEvent.press(screen.getByText('Switch mission'));
    await waitFor(() => expect(mockRouter.back).toHaveBeenCalled());
    expect(mockCapture).toHaveBeenCalled();
    expect(mockCapture.mock.invocationCallOrder[0]).toBeLessThan(mockRouter.back.mock.invocationCallOrder[0]);
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
