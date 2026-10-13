import * as Haptics from 'expo-haptics';

import { useToast } from '@/stores/toast';

function haptic(type: Haptics.NotificationFeedbackType): void {
  // Haptics are best-effort (simulators, low-power mode); never surface their failures.
  void Haptics.notificationAsync(type).catch(() => {});
}

/** A long-press placed or moved a point on the map: a firm tap so the user feels it land. */
export function notifyPlaced(): void {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
}

/** A write succeeded (Add, Save, Delete). */
export function notifySuccess(): void {
  haptic(Haptics.NotificationFeedbackType.Success);
}

/** A command failed: toast plus error haptic (spec §12). */
export function notifyError(message: string): void {
  useToast.getState().show(message, 'error');
  haptic(Haptics.NotificationFeedbackType.Error);
}

export function notifyInfo(message: string): void {
  useToast.getState().show(message, 'info');
}
