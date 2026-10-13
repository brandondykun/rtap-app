import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';

import { makeTestContext } from '@/lib/db/test-database';
import { renderWithProviders } from '@/test-utils/render';

import { createMission, deleteMission } from './commands';
import { RenameMissionScreen } from './RenameMissionScreen';
import { findMission } from './repository';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));

beforeEach(() => jest.clearAllMocks());

async function open() {
  const ctx = makeTestContext();
  const r = await createMission(ctx, { name: 'Op Iron' });
  if (!r.ok) throw new Error('setup');
  await renderWithProviders(<RenameMissionScreen missionId={r.value.id} />, ctx);
  await screen.findByDisplayValue('Op Iron');
  return { ctx, id: r.value.id };
}

describe('RenameMissionScreen', () => {
  it('opens with the current name and saves a new one', async () => {
    const { ctx, id } = await open();
    expect(screen.getByText('Rename mission')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Mission name'), 'Op Steel');
    await fireEvent.press(screen.getByText('Save'));
    await waitFor(() => expect(mockRouter.back).toHaveBeenCalledTimes(1));
    expect((await findMission(ctx.db, id))?.name).toBe('Op Steel');
    expect(Haptics.notificationAsync).toHaveBeenCalledWith(Haptics.NotificationFeedbackType.Success);
  });

  it('shows an error for a blank name and stays open', async () => {
    const { ctx, id } = await open();
    await fireEvent.changeText(screen.getByLabelText('Mission name'), '  ');
    await fireEvent.press(screen.getByText('Save'));
    expect(await screen.findByText('Enter a mission name.')).toBeTruthy();
    expect(mockRouter.back).not.toHaveBeenCalled();
    expect((await findMission(ctx.db, id))?.name).toBe('Op Iron');
  });

  it('cancels without saving', async () => {
    const { ctx, id } = await open();
    await fireEvent.changeText(screen.getByLabelText('Mission name'), 'Op Steel');
    await fireEvent.press(screen.getByText('Cancel'));
    expect(mockRouter.back).toHaveBeenCalled();
    expect((await findMission(ctx.db, id))?.name).toBe('Op Iron');
  });

  it('closes when the mission was deleted before Save', async () => {
    const { ctx, id } = await open();
    await deleteMission(ctx, id);
    await fireEvent.press(screen.getByText('Save'));
    await waitFor(() => expect(mockRouter.back).toHaveBeenCalledTimes(1));
    expect(Haptics.notificationAsync).not.toHaveBeenCalled();
  });

  it('closes for an unknown mission', async () => {
    await renderWithProviders(<RenameMissionScreen missionId="nope" />);
    await waitFor(() => expect(mockRouter.back).toHaveBeenCalled());
    expect(screen.queryByLabelText('Mission name')).toBeNull();
  });
});
