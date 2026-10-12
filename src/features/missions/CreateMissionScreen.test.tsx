import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { firstValueFrom } from 'rxjs';

import { makeTestContext } from '@/lib/db/test-database';
import { renderWithProviders } from '@/test-utils/render';

import { createMission } from './commands';
import { CreateMissionScreen } from './CreateMissionScreen';
import { observeMissionSummaries } from './repository';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));

beforeEach(() => jest.clearAllMocks());

describe('CreateMissionScreen', () => {
  it('prefills the next mission name', async () => {
    const ctx = makeTestContext();
    await createMission(ctx, { name: 'A' });
    await createMission(ctx, { name: 'B' });
    await renderWithProviders(<CreateMissionScreen />, ctx);
    expect(await screen.findByDisplayValue('Mission 3')).toBeTruthy();
  });

  it('creates the mission and replaces the sheet with its map', async () => {
    const { ctx } = await renderWithProviders(<CreateMissionScreen />);
    await screen.findByDisplayValue('Mission 1');
    await fireEvent.changeText(screen.getByLabelText('Mission name'), 'Op Iron');
    await fireEvent.press(screen.getByText('Create'));

    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledTimes(1));
    const [mission] = await firstValueFrom(observeMissionSummaries(ctx.db));
    expect(mission.name).toBe('Op Iron');
    expect(mockRouter.replace).toHaveBeenCalledWith({
      pathname: '/missions/[missionId]',
      params: { missionId: mission.id },
    });
  });

  it('creates exactly one mission when Create is tapped twice', async () => {
    const { ctx } = await renderWithProviders(<CreateMissionScreen />);
    await screen.findByDisplayValue('Mission 1');
    const create = screen.getByText('Create');
    await fireEvent.press(create);
    await fireEvent.press(create);

    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledTimes(1));
    expect(await firstValueFrom(observeMissionSummaries(ctx.db))).toHaveLength(1);
  });

  it('shows an error for a blank name and stays open', async () => {
    await renderWithProviders(<CreateMissionScreen />);
    await screen.findByDisplayValue('Mission 1');
    await fireEvent.changeText(screen.getByLabelText('Mission name'), '   ');
    await fireEvent.press(screen.getByText('Create'));
    expect(await screen.findByText('Enter a mission name.')).toBeTruthy();
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it('cancels back to the list', async () => {
    await renderWithProviders(<CreateMissionScreen />);
    await fireEvent.press(screen.getByText('Cancel'));
    expect(mockRouter.back).toHaveBeenCalled();
  });
});
