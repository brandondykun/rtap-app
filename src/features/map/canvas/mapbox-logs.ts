import type { Logger } from '@rnmapbox/maps';

type LogObject = Parameters<Parameters<typeof Logger.setLogCallback>[0]>[0];

/**
 * A tile that failed to download (rate limit, server error, no connection). The map just shows the
 * gap and retries, so these are not app errors and must not raise the dev error toast.
 */
export function isTileLoadFailure(log: LogObject): boolean {
  return log.message.includes('Failed to load tile');
}
