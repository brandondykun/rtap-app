import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';

import { INITIAL_DRAFT, useDraft } from '@/stores/draft';
import { INITIAL_INTERACTION, useInteraction } from '@/stores/interaction';
import { useToast } from '@/stores/toast';
import { renderWithProviders } from '@/test-utils/render';

import { AddUnitMenu } from './AddUnitMenu';

jest.mock('../commands', () => ({
  ...jest.requireActual('../commands'),
  placePoint: jest.fn(async () => ({ ok: false, error: 'write_failed', message: 'disk full' })),
}));

beforeEach(() => {
  useDraft.setState(INITIAL_DRAFT);
  useToast.setState({ toast: null });
  useInteraction.setState(INITIAL_INTERACTION);
  useInteraction.getState().setCamera({ center: { lat: 38.8977, lon: -77.0365 }, zoom: 14, bearing: 0 });
});

it('shows a toast and an error haptic when the point cannot be saved', async () => {
  await renderWithProviders(<AddUnitMenu params={{}} missionId="m1" />);
  await screen.findByDisplayValue('HOS-1');
  await fireEvent.press(screen.getByLabelText('Add'));
  await waitFor(() => expect(useToast.getState().toast?.message).toBe('Could not add the unit.'));
  expect(Haptics.notificationAsync).toHaveBeenCalledWith(Haptics.NotificationFeedbackType.Error);
  expect(screen.getByDisplayValue('HOS-1')).toBeTruthy();
});
