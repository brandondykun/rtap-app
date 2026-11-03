import { useEffect, useRef, useState, type ReactNode } from 'react';
import { View } from 'react-native';

import { MenuHeader } from '@/components/menu/MenuHeader';
import { notifyError, notifySuccess } from '@/features/feedback/feedback';
import { addItemToOverlays } from '@/features/overlays/commands';
import { NewItemOverlaysSection } from '@/features/overlays/ItemOverlaysSection';
import type { ItemCategory } from '@/features/symbology/categories';
import { useCommandContext } from '@/lib/db/command-context-provider';
import type { LatLon } from '@/lib/geo/types';
import { useDraft, type UnitPreset } from '@/stores/draft';
import { useInteraction } from '@/stores/interaction';
import { useMenu } from '@/stores/menu';

import { ITEM_ADAPTERS } from './item-adapters';
import { ITEM_COPY, openItemMenu } from './item-menus';

/** Add unit / point / line / polygon: starts a draft of the category, writes it (in the overlays chosen) on Add, then shows it selected. */
export function AddItemPanel({
  category,
  at,
  unitPreset,
  missionId,
  form,
}: {
  category: ItemCategory;
  at?: LatLon;
  unitPreset?: UnitPreset;
  missionId: string;
  form: ReactNode;
}) {
  const ctx = useCommandContext();
  const close = useMenu((s) => s.closeMenu);
  // A ref, not state: a second tap in the same frame must see the first tap's lock.
  const busy = useRef(false);
  // None: the new item goes in Base.
  const [overlayIds, setOverlayIds] = useState<string[]>([]);
  const { noun } = ITEM_COPY[category];
  const adapter = ITEM_ADAPTERS[category];

  useEffect(() => {
    if (category === 'line') useDraft.getState().startAddLine();
    else if (category === 'polygon') useDraft.getState().startAddPolygon();
    else {
      const start = at ?? useInteraction.getState().cameraCenter;
      useDraft.getState().startAdd({ coord: start, source: at ? 'press' : 'crosshair', category, unitPreset });
    }
    return () => useDraft.getState().clear();
    // Opened once per panel; later long-presses move the draft instead of reopening.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canAdd = useDraft((s) => adapter.canSave(s));

  const add = async () => {
    if (busy.current || !canAdd) return;
    busy.current = true;
    const d = useDraft.getState();
    const result = await adapter.place(ctx, missionId, d);
    if (!result.ok) {
      busy.current = false;
      notifyError(result.error === 'invalid_name' ? 'Enter a name.' : `Could not add the ${noun}.`);
      return;
    }
    // The item is saved either way; if this fails it is left in Base.
    const linked = await addItemToOverlays(ctx, { missionId, itemId: result.value.id, overlayIds });
    if (linked.ok) notifySuccess();
    else notifyError(`Added the ${noun}, but could not put it in its overlays.`);
    // Hand over to the new item, shown selected (the menu is replaced, so the lock stays on).
    // Skip if the user cancelled or switched menus while the write was in flight.
    if (useDraft.getState().mode === 'add') openItemMenu(result.value.id, adapter.ref(d));
  };

  return (
    <View>
      <MenuHeader
        title={`Add ${noun}`}
        leading={{ label: 'Cancel', onPress: close }}
        trailing={{ label: category === 'line' || category === 'polygon' ? 'Save' : 'Add', icon: 'check', onPress: () => void add(), disabled: !canAdd }}
      />
      {/* A little room between the header's Cancel / Add and the first field. */}
      <View testID="add-form" className="pt-3">
        {form}
        <NewItemOverlaysSection missionId={missionId} value={overlayIds} onChange={setOverlayIds} />
      </View>
    </View>
  );
}
