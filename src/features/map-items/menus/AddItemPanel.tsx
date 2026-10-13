import { useEffect, useRef, type ReactNode } from 'react';
import { View } from 'react-native';

import { MenuHeader } from '@/components/menu/MenuHeader';
import { notifyError, notifySuccess } from '@/features/feedback/feedback';
import type { ItemCategory } from '@/features/symbology/categories';
import { useCommandContext } from '@/lib/db/command-context-provider';
import type { LatLon } from '@/lib/geo/types';
import { useDraft } from '@/stores/draft';
import { useInteraction } from '@/stores/interaction';
import { useMenu } from '@/stores/menu';

import { ITEM_ADAPTERS } from './item-adapters';
import { ITEM_COPY, openItemMenu } from './item-menus';

/** Add unit / point / line: starts a draft of the category, writes it on Add, then shows it selected. */
export function AddItemPanel({ category, at, missionId, form }: { category: ItemCategory; at?: LatLon; missionId: string; form: ReactNode }) {
  const ctx = useCommandContext();
  const close = useMenu((s) => s.closeMenu);
  // A ref, not state: a second tap in the same frame must see the first tap's lock.
  const busy = useRef(false);
  const { noun } = ITEM_COPY[category];
  const adapter = ITEM_ADAPTERS[category];

  useEffect(() => {
    if (category === 'line') useDraft.getState().startAddLine();
    else {
      const start = at ?? useInteraction.getState().cameraCenter;
      useDraft.getState().startAdd({ coord: start, source: at ? 'press' : 'crosshair', category });
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
    notifySuccess();
    // Hand over to the new item, shown selected (the menu is replaced, so the lock stays on).
    // Skip if the user cancelled or switched menus while the write was in flight.
    if (useDraft.getState().mode === 'add') openItemMenu(result.value.id, adapter.ref(d));
  };

  return (
    <View>
      <MenuHeader
        title={`Add ${noun}`}
        leading={{ label: 'Cancel', onPress: close }}
        trailing={{ label: category === 'line' ? 'Save' : 'Add', icon: 'check', onPress: () => void add(), disabled: !canAdd }}
      />
      {form}
    </View>
  );
}
