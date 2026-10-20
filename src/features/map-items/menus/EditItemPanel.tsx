import { useEffect, useRef, type ReactNode } from 'react';
import { View } from 'react-native';

import { MenuActions } from '@/components/menu/MenuActions';
import { MenuHeader } from '@/components/menu/MenuHeader';
import { MenuSection } from '@/components/menu/MenuSection';
import { MenuToggle } from '@/components/menu/MenuToggle';
import { notifyError, notifySuccess } from '@/features/feedback/feedback';
import { itemCategory, type ItemCategory } from '@/features/symbology/categories';
import { useObservable } from '@/hooks/use-observable';
import { useCommandContext } from '@/lib/db/command-context-provider';
import { useDraft } from '@/stores/draft';
import { useMenu } from '@/stores/menu';

import { deleteItem, setItemHidden } from '../commands';
import { observeHiddenItemIds, observeItem, type MapItemSnapshot } from '../repository';
import { ITEM_ADAPTERS } from './item-adapters';
import { ITEM_COPY, openItemMenu } from './item-menus';

const NO_IDS: string[] = [];

type Props = { category: ItemCategory; itemId: string; missionId: string; form: ReactNode };

/** Unit / Point / Line view: opens read-only; Edit unlocks the form, Save or Cancel locks it again. */
export function EditItemPanel({ category, itemId, form }: Props) {
  const { noun, title } = ITEM_COPY[category];
  const adapter = ITEM_ADAPTERS[category];
  const GONE = `That ${noun} no longer exists.`;
  const ctx = useCommandContext();
  const closeMenu = useMenu((s) => s.closeMenu);
  const back = useMenu((s) => s.back);
  // Drilled into from another menu (Layers): leaving goes back there instead of closing.
  const drilled = useMenu((s) => s.stack.length > 1);
  const close = drilled ? back : closeMenu;
  // undefined = still loading; null = missing or deleted.
  const item = useObservable<MapItemSnapshot | null | undefined>(() => observeItem(ctx.db, itemId), undefined, [ctx, itemId]);
  const hiddenIds = useObservable(() => observeHiddenItemIds(ctx.db), NO_IDS, [ctx]);
  const ready = useDraft((s) => s.mode === 'edit' && s.itemId === itemId);
  const valid = useDraft((s) => adapter.canSave(s));
  // Opens view-only; Edit unlocks the form, Save or Cancel locks it again.
  const locked = useDraft((s) => s.locked);
  const started = useRef(false);
  // Set before we close or delete ourselves, so the item vanishing is not reported as "missing".
  const leaving = useRef(false);
  const busy = useRef(false);

  useEffect(() => {
    if (item === undefined || leaving.current) return;
    if (!item) {
      leaving.current = true;
      notifyError(GONE);
      close();
      return;
    }
    // Opened in the other category's menu (a stale link): hand over to the right one.
    if (itemCategory(item) !== category) {
      leaving.current = true;
      if (drilled) back();
      openItemMenu(item.id, item, { drill: drilled });
      return;
    }
    if (started.current) return;
    started.current = true;
    // Unreadable geometry: report it like a missing item.
    if (!adapter.select(item)) {
      leaving.current = true;
      notifyError(GONE);
      close();
    }
  }, [item, close, back, drilled, category, GONE, adapter]);

  useEffect(() => () => useDraft.getState().clear(), []);

  const canSave = ready && !locked && valid;

  const save = async () => {
    if (busy.current || !canSave) return;
    busy.current = true;
    const d = useDraft.getState();
    let result;
    try {
      result = await adapter.update(ctx, itemId, d);
    } finally {
      busy.current = false;
    }
    if (result.ok) {
      notifySuccess();
      // Back to the view-only item; the draft already holds what was saved.
      useDraft.getState().setLocked(true);
    } else if (result.error === 'not_found') {
      leaving.current = true;
      notifyError(GONE);
      close();
    } else {
      notifyError(result.error === 'invalid_name' ? 'Enter a name.' : `Could not save the ${noun}.`);
    }
  };

  const remove = async () => {
    if (busy.current) return;
    busy.current = true;
    leaving.current = true;
    let result;
    try {
      result = await deleteItem(ctx, itemId);
    } finally {
      busy.current = false;
    }
    if (result.ok) {
      notifySuccess();
      close();
    } else {
      leaving.current = false;
      notifyError(`Could not delete the ${noun}.`);
    }
  };

  /** Cancel editing: drop the changes and show the saved item again, read-only. */
  const cancelEdit = () => {
    if (item && !adapter.select(item)) close();
  };

  const setHidden = (hidden: boolean) => {
    void setItemHidden(ctx, itemId, hidden).then((result) => {
      if (!result.ok) notifyError('Could not change visibility.');
    });
  };

  return (
    <View>
      {locked ? (
        <MenuHeader
          title={title}
          leading={drilled ? { label: 'Back', icon: 'chevron-left', onPress: back } : { label: 'Close', onPress: closeMenu }}
          trailing={{ label: 'Edit', icon: 'pencil', onPress: () => useDraft.getState().setLocked(false), disabled: !ready }}
        />
      ) : (
        <MenuHeader
          title={`Edit ${noun}`}
          leading={{ label: 'Cancel', onPress: cancelEdit }}
          trailing={{ label: 'Save', icon: 'check', onPress: () => void save(), disabled: !canSave }}
        />
      )}
      {ready ? (
        <>
          {form}
          <MenuSection>
            <MenuToggle label="Hidden on map" value={hiddenIds.includes(itemId)} onValueChange={setHidden} disabled={locked} />
          </MenuSection>
          <MenuActions disabled={locked} destructive={{ label: `Delete ${noun}`, confirmLabel: 'Tap again to delete', onConfirm: () => void remove() }} />
        </>
      ) : null}
    </View>
  );
}
