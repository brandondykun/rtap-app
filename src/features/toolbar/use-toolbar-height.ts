import { toolbarHeight } from '@/features/map/layout';
import { useSettings } from '@/stores/settings';

/** The toolbar's current height: shorter while its text is hidden. Everything placed under the toolbar uses it. */
export function useToolbarHeight(): number {
  return useSettings((s) => toolbarHeight(s.showToolbarText));
}
