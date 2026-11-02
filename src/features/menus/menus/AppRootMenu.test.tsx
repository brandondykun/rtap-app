import { fireEvent, screen, waitFor, within } from '@testing-library/react-native';

import { placePoint } from '@/features/map-items/commands';
import { createMission } from '@/features/missions/commands';
import { makeTestContext } from '@/lib/db/test-database';
import { INITIAL_INTERACTION, useInteraction } from '@/stores/interaction';
import { INITIAL_MENU, useMenu } from '@/stores/menu';
import { renderWithProviders } from '@/test-utils/render';

import { AppRootMenu } from './AppRootMenu';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));

beforeEach(() => {
  jest.clearAllMocks();
  useMenu.setState(INITIAL_MENU);
  useInteraction.setState(INITIAL_INTERACTION);
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

  it('opens Settings in place of the menu (its Close closes it)', async () => {
    await renderWithProviders(<AppRootMenu params={{}} missionId="m1" />);
    const rows = screen.getAllByRole('button').map((b) => b.props.accessibilityLabel as string);
    expect(rows.filter((l) => ['Switch mission', 'Settings', 'About'].includes(l))).toEqual(['Switch mission', 'Settings', 'About']);
    await fireEvent.press(screen.getByText('Settings'));
    expect(useMenu.getState().stack.map((e) => e.id)).toEqual(['settings']);
  });

  it('shows the current mission: name, counts, when it was saved and the square under the crosshair', async () => {
    const ctx = makeTestContext();
    const m = await createMission(ctx, { name: 'Mission 1' });
    if (!m.ok) throw new Error('setup');
    await placePoint(ctx, { missionId: m.value.id, coord: { lat: 38.9, lon: -77 }, sidc: 'SHGPUCI--------', name: 'HOS-1' });
    useInteraction.getState().setCamera({ center: { lat: 38.9, lon: -77 }, zoom: 12, bearing: 0 });
    await renderWithProviders(<AppRootMenu params={{}} missionId={m.value.id} />, ctx);
    const card = within(screen.getByTestId('current-mission-card'));
    expect(card.getByText('Current mission')).toBeTruthy();
    expect(await card.findByText('Mission 1')).toBeTruthy();
    expect(await card.findByLabelText('1 unit · 0 points · 0 lines · 0 polygons')).toBeTruthy();
    expect(await card.findByTestId('current-mission-saved')).toHaveTextContent(/^Saved .+ · 18S UJ$/);
    expect(card.getByRole('button', { name: 'Switch mission' })).toBeTruthy();
  });

  it('names the app in the header and says what Settings and About hold', async () => {
    await renderWithProviders(<AppRootMenu params={{}} missionId="m1" />);
    expect(screen.getByText('RTAP')).toBeTruthy();
    expect(screen.getByText('Grid format, units, display')).toBeTruthy();
    expect(screen.getByText(/^Toolbar guide/)).toBeTruthy();
  });
});
