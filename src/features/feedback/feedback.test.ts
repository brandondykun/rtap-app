import * as Haptics from 'expo-haptics';

import { useToast } from '@/stores/toast';

import { notifyError, notifyInfo, notifyPlaced, notifySuccess } from './feedback';

beforeEach(() => {
  jest.clearAllMocks();
  useToast.setState({ toast: null });
});

describe('feedback', () => {
  it('plays a medium impact when a point is placed by long-press', () => {
    notifyPlaced();
    expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Medium);
  });

  it('plays a success haptic without a toast', () => {
    notifySuccess();
    expect(Haptics.notificationAsync).toHaveBeenCalledWith(Haptics.NotificationFeedbackType.Success);
    expect(useToast.getState().toast).toBeNull();
  });

  it('shows an error toast with an error haptic', () => {
    notifyError('Could not save the point.');
    expect(useToast.getState().toast).toMatchObject({ message: 'Could not save the point.', kind: 'error' });
    expect(Haptics.notificationAsync).toHaveBeenCalledWith(Haptics.NotificationFeedbackType.Error);
  });

  it('shows an info toast without a haptic', () => {
    notifyInfo('Point hidden');
    expect(useToast.getState().toast).toMatchObject({ kind: 'info' });
    expect(Haptics.notificationAsync).not.toHaveBeenCalled();
  });
});
