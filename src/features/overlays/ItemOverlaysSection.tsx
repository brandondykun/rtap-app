import { Text } from 'react-native';

import { MenuSection } from '@/components/menu/MenuSection';
import { notifyError } from '@/features/feedback/feedback';
import { useObservable } from '@/hooks/use-observable';
import { useCommandContext } from '@/lib/db/command-context-provider';

import { moveItemToBase, setItemInOverlay } from './commands';
import { OverlayChips } from './OverlayChips';
import { BASE_OVERLAY_ID, baseOverlay, observeItemOverlayIds, type Overlay } from './repository';
import { useBaseHidden, useMissionOverlays } from './use-mission-overlays';

const NO_IDS: string[] = [];

/** "Phase 1", "Phase 1 and Phase 2", "Phase 1, Phase 2 and Fires". */
function listNames(names: readonly string[]): string {
  return names.length <= 1 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/**
 * Under the chips: which overlays the item is in (or, while adding it, will be in), and when that puts it on the map.
 * `allOff`: every one of them (or Base) is turned off right now, so the item does not show.
 */
export function itemOverlaysHint(names: readonly string[], { adding = false, allOff = false }: { adding?: boolean; allOff?: boolean } = {}): string {
  const is = adding ? 'will be in' : 'is in';
  const where =
    names.length === 0
      ? `This item ${is} Base. It shows on the map while Base is turned on. Tap another overlay to ${adding ? 'put it there instead' : 'move it there'}.`
      : names.length === 1
        ? `This item ${is} ${names[0]}. It shows on the map while ${names[0]} is turned on.`
        : `This item ${is} ${listNames(names)}. It shows on the map while any one of them is turned on.`;
  if (!allOff) return where;
  return names.length <= 1
    ? `${where} ${names[0] ?? 'Base'} is turned off right now, so the item won't show until you turn it on.`
    : `${where} They are all turned off right now, so the item won't show until you turn one on.`;
}

/**
 * The Overlays chips for one item: Base, lit while the item is in no overlay, then the mission's overlays. Tap an overlay
 * to put the item in it or take it out, or Base to take it out of them all. Nothing until the mission has overlays (they
 * are made in Layers).
 */
function OverlayPicker({
  missionId,
  inIds,
  adding,
  onToggle,
  onBase,
}: {
  missionId: string;
  inIds: readonly string[];
  adding: boolean;
  onToggle: (overlay: Overlay, inOverlay: boolean) => void;
  onBase: () => void;
}) {
  // Remembered, so the section is there from the menu's first frame (a section arriving late moved the sheet).
  const overlays = useMissionOverlays(missionId);
  const baseHidden = useBaseHidden(missionId);
  if (overlays.length === 0) return null;
  const inSet = new Set(inIds);
  const chosen = overlays.filter((o) => inSet.has(o.id));
  const inBase = chosen.length === 0;
  const allOff = inBase ? baseHidden : chosen.every((o) => o.hidden);
  return (
    <MenuSection label="Overlays">
      <OverlayChips
        testID="item-overlays"
        overlays={[baseOverlay(missionId, false), ...overlays]}
        isOn={(o) => (o.id === BASE_OVERLAY_ID ? inBase : inSet.has(o.id))}
        label={(o) => (o.id === BASE_OVERLAY_ID ? (inBase ? 'In Base' : 'Move to Base') : inSet.has(o.id) ? `Take out of ${o.name}` : `Add to ${o.name}`)}
        onToggle={(o) => {
          // Base is lit while the item is in no overlay: tapping it then changes nothing.
          if (o.id === BASE_OVERLAY_ID) {
            if (!inBase) onBase();
          } else onToggle(o, !inSet.has(o.id));
        }}
      />
      <Text testID="item-overlays-hint" className="text-xs text-text-muted">
        {itemOverlaysHint(
          chosen.map((o) => o.name),
          { adding, allOff },
        )}
      </Text>
    </MenuSection>
  );
}

/** An item's overlays, in its view: each tap is saved at once. */
export function ItemOverlaysSection({ missionId, itemId }: { missionId: string; itemId: string }) {
  const ctx = useCommandContext();
  const inIds = useObservable(() => observeItemOverlayIds(ctx.db, itemId), NO_IDS, [ctx, itemId]);
  const done = (r: { ok: boolean }) => {
    if (!r.ok) notifyError('Could not change the overlay.');
  };
  return (
    <OverlayPicker
      missionId={missionId}
      inIds={inIds}
      adding={false}
      onToggle={(o, inOverlay) => void setItemInOverlay(ctx, { missionId, itemId, overlayId: o.id, inOverlay }).then(done)}
      onBase={() => void moveItemToBase(ctx, itemId).then(done)}
    />
  );
}

/** A new item's overlays, while adding it: chosen here, put in on Add (see `addItemToOverlays`). */
export function NewItemOverlaysSection({ missionId, value, onChange }: { missionId: string; value: readonly string[]; onChange: (ids: string[]) => void }) {
  return (
    <OverlayPicker
      missionId={missionId}
      inIds={value}
      adding
      onToggle={(o, inOverlay) => onChange(inOverlay ? [...value, o.id] : value.filter((id) => id !== o.id))}
      onBase={() => onChange([])}
    />
  );
}
