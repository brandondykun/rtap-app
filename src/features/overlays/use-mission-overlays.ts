import { useRememberedObservable } from '@/hooks/use-observable';
import { useCommandContext } from '@/lib/db/command-context-provider';

import { observeBaseHidden, observeMissionOverlays, type Overlay } from './repository';

const NO_OVERLAYS: Overlay[] = [];

/**
 * The mission's overlays, remembered between menus (`useRememberedObservable`): a menu that shows them opens with them
 * instead of without, and then grows. The map screen keeps them running (`useKeepOverlaysAtHand`), so even the first item
 * opened has them.
 */
export function useMissionOverlays(missionId: string): Overlay[] {
  const ctx = useCommandContext();
  return useRememberedObservable(ctx.db, `overlays:${missionId}`, () => observeMissionOverlays(ctx.db, missionId), NO_OVERLAYS, []);
}

/** Whether Base is turned off, remembered between menus like `useMissionOverlays`. */
export function useBaseHidden(missionId: string): boolean {
  const ctx = useCommandContext();
  return useRememberedObservable(ctx.db, `baseHidden:${missionId}`, () => observeBaseHidden(ctx.db, missionId), false, []);
}

/** For the map screen: keeps the mission's overlays and Base current while it is open, for the menus opened over it. */
export function useKeepOverlaysAtHand(missionId: string): void {
  useMissionOverlays(missionId);
  useBaseHidden(missionId);
}
