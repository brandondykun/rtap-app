import { Text } from 'react-native';

import { MenuSection } from '@/components/menu/MenuSection';
import { notifyError } from '@/features/feedback/feedback';
import { useObservable } from '@/hooks/use-observable';
import { useCommandContext } from '@/lib/db/command-context-provider';

import { moveItemToBase, setItemInOverlay } from './commands';
import { OverlayChips } from './OverlayChips';
import { BASE_OVERLAY_ID, baseOverlay, observeItemOverlayIds, observeMissionOverlays, type Overlay } from './repository';

const NO_OVERLAYS: Overlay[] = [];

/** "Phase 1", "Phase 1 and Phase 2", "Phase 1, Phase 2 and Fires". */
function listNames(names: readonly string[]): string {
  return names.length <= 1 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/** Under the chips: which overlays the item is in, and when that puts it on the map. */
export function itemOverlaysHint(names: readonly string[]): string {
  if (names.length === 0) return 'This item is in Base. It shows on the map while Base is turned on. Tap another overlay to move it there.';
  if (names.length === 1) return `This item is in ${names[0]}. It shows on the map while ${names[0]} is turned on.`;
  return `This item is in ${listNames(names)}. It shows on the map while any one of them is turned on.`;
}
const NO_IDS: string[] = [];

/**
 * An item's overlays, in its view: Base, lit while it is in no overlay, then the mission's overlays. Tap an overlay to put
 * the item in it or take it out, or Base to take it out of them all (saved at once). Nothing until the mission has
 * overlays (they are made in Layers).
 */
export function ItemOverlaysSection({ missionId, itemId }: { missionId: string; itemId: string }) {
  const ctx = useCommandContext();
  const overlays = useObservable(() => observeMissionOverlays(ctx.db, missionId), NO_OVERLAYS, [ctx, missionId]);
  const inIds = useObservable(() => observeItemOverlayIds(ctx.db, itemId), NO_IDS, [ctx, itemId]);
  if (overlays.length === 0) return null;
  const inSet = new Set(inIds);
  const inBase = inIds.length === 0;
  const isOn = (o: Overlay) => (o.id === BASE_OVERLAY_ID ? inBase : inSet.has(o.id));
  const toggle = (o: Overlay) => {
    // Base is lit while the item is in no overlay: tapping it then changes nothing.
    if (o.id === BASE_OVERLAY_ID) return inBase ? Promise.resolve({ ok: true as const, value: undefined }) : moveItemToBase(ctx, itemId);
    return setItemInOverlay(ctx, { missionId, itemId, overlayId: o.id, inOverlay: !inSet.has(o.id) });
  };
  return (
    <MenuSection label="Overlays">
      <OverlayChips
        testID="item-overlays"
        overlays={[baseOverlay(missionId, false), ...overlays]}
        isOn={isOn}
        label={(o) => (o.id === BASE_OVERLAY_ID ? (inBase ? 'In Base' : 'Move to Base') : inSet.has(o.id) ? `Take out of ${o.name}` : `Add to ${o.name}`)}
        onToggle={(o) =>
          void toggle(o).then((r) => {
            if (!r.ok) notifyError('Could not change the overlay.');
          })
        }
      />
      <Text testID="item-overlays-hint" className="text-xs text-text-muted">
        {itemOverlaysHint(overlays.filter((o) => inSet.has(o.id)).map((o) => o.name))}
      </Text>
    </MenuSection>
  );
}
