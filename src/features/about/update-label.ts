export type RunningUpdate = { isEnabled: boolean; channel: string | null; updateId: string | null; isEmbeddedLaunch: boolean };

/**
 * What code this phone runs, for the About page: its update channel, then "built-in" (what shipped in the store build)
 * or the first block of the over-the-air update's id, so two phones can be compared at a glance.
 */
export function updateLabel(u: RunningUpdate): string {
  const running = u.isEnabled && !u.isEmbeddedLaunch && u.updateId ? `update ${u.updateId.split('-')[0]}` : 'built-in';
  return u.channel ? `${u.channel} · ${running}` : running;
}
