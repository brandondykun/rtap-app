// Not beside the route: every file under src/app is a route to Expo Router.
import { screen } from '@testing-library/react-native';

import MissionsRoute from '@/app/index';
import { DEFAULT_PROFILE, useProfile } from '@/stores/profile';
import { renderWithProviders } from '@/test-utils/render';

jest.mock('expo-router', () => ({ Redirect: ({ href }: { href: string }) => (jest.requireActual('react') as typeof import('react')).createElement(jest.requireActual('react-native').Text, null, `redirect ${href}`) }));
jest.mock('@/features/missions/MissionsScreen', () => ({ MissionsScreen: () => (jest.requireActual('react') as typeof import('react')).createElement(jest.requireActual('react-native').Text, null, 'missions') }));

beforeEach(() => useProfile.setState(DEFAULT_PROFILE));

describe('the app\'s first screen', () => {
  it('is the landing screen until Get started', async () => {
    await renderWithProviders(<MissionsRoute />);
    expect(screen.getByText('redirect /welcome')).toBeTruthy();
  });

  it('is the missions once the landing was seen', async () => {
    useProfile.getState().markLandingSeen();
    await renderWithProviders(<MissionsRoute />);
    expect(screen.getByText('missions')).toBeTruthy();
    expect(screen.queryByText(/redirect/)).toBeNull();
  });
});
