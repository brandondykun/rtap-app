import { notifyInfo } from '@/features/feedback/feedback';
import { useGpsAverage } from '@/stores/gps-average';
import { useMyLocation } from '@/stores/my-location';
import { useToast } from '@/stores/toast';

/** Shown, until closed, when averaging starts: a moving device just keeps pausing it. */
export const AVERAGE_START_MESSAGE = 'Keep the device still. Averaging gets more accurate over a few minutes.';

/** Starts averaging, unless the position is manual (there is no GPS to average). Returns whether it started. */
export function startAveraging(): boolean {
  if (useMyLocation.getState().source === 'manual') {
    notifyInfo('Averaging needs GPS. Switch your location to GPS first.');
    return false;
  }
  useGpsAverage.getState().start();
  useToast.getState().show(AVERAGE_START_MESSAGE, 'info', { sticky: true });
  return true;
}
