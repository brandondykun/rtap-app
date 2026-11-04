import { notifyInfo } from '@/features/feedback/feedback';
import { useGpsAverage } from '@/stores/gps-average';
import { useMyLocation } from '@/stores/my-location';
import { usePresence } from '@/stores/presence';
import { useToast } from '@/stores/toast';

/** Shown, until closed, when averaging starts: a moving device just keeps pausing it. */
export const AVERAGE_START_MESSAGE = 'Keep the device still. Averaging gets more accurate over a few minutes.';

/** Stops waiting to hide the last keep-still message (one at a time, however often averaging restarts). */
let unwatchStartMessage: (() => void) | null = null;

/** Hides the keep-still message once Average mode turns off, if it is still showing (another toast may have replaced it). */
function hideStartMessageWhenOff(id: number) {
  unwatchStartMessage?.();
  const unwatch = useGpsAverage.subscribe((state) => {
    if (state.phase !== 'off') return;
    useToast.getState().hide(id);
    unwatch();
    if (unwatchStartMessage === unwatch) unwatchStartMessage = null;
  });
  unwatchStartMessage = unwatch;
}

/** Starts averaging, unless there is no GPS to average (manual position, or location off). Returns whether it started. */
export function startAveraging(): boolean {
  if (useMyLocation.getState().source === 'manual') {
    notifyInfo('Averaging needs GPS. Switch your location to GPS first.');
    return false;
  }
  const { locationStatus } = usePresence.getState();
  if (locationStatus === 'denied' || locationStatus === 'unavailable') {
    notifyInfo('Averaging needs GPS. Turn on location first.');
    return false;
  }
  useGpsAverage.getState().start();
  useToast.getState().show(AVERAGE_START_MESSAGE, 'info', { sticky: true });
  const shown = useToast.getState().toast;
  if (shown) hideStartMessageWhenOff(shown.id);
  return true;
}
