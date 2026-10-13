import { useEffect, useRef, type ReactNode } from 'react';
import { View } from 'react-native';

import { MenuActions } from '@/components/menu/MenuActions';
import { MenuHeader } from '@/components/menu/MenuHeader';
import { MenuSection } from '@/components/menu/MenuSection';
import { MenuToggle } from '@/components/menu/MenuToggle';
import { notifyError, notifySuccess } from '@/features/feedback/feedback';
import { itemCategory, type ItemCategory } from '@/features/symbology/categories';
import { pointTypeForSidc } from '@/features/symbology/point-types';
import { decomposeSidc } from '@/features/symbology/presets';
import { useObservable } from '@/hooks/use-observable';
import { useCommandContext } from '@/lib/db/command-context-provider';
import { useDraft } from '@/stores/draft';
import { useMenu } from '@/stores/menu';

import { deleteItem, setItemHidden, updateItem } from '../commands';
import { draftSidc } from '../draft-sidc';
import { pointCoord } from '../geometry';
import { observeHiddenItemIds, observeItem, type MapItemSnapshot } from '../repository';
import { ITEM_COPY, openItemMenu } from './item-menus';

/** Loads an item into the draft, selected and read-only. False when its geometry is unreadable. */
function selectItem(item: MapItemSnapshot): boolean {
  const at = pointCoord(item.geometry);
  if (!at) return false;
  const unit = (item.sidc ? decomposeSidc(item.sidc) : null) ?? { affiliation: 'unknown' as const, unitType: 'unspecified' as const };
  useDraft.getState().startEdit({
    itemId: item.id,
    coord: at,
    category: itemCategory(item.sidc),
    affiliation: unit.affiliation,
    unitType: unit.unitType,
    pointType: pointTypeForSidc(item.sidc) ?? 'checkpoint',
    name: item.name,
    notes: item.notes ?? '',
  });
  return true;
}
const NO_IDS: string[] = [];

type Props = { category: ItemCategory; itemId: string; missionId: string; form: ReactNode };

/** Unit / Point view: opens read-only; Edit unlocks the form, Save or Cancel locks it again. */
export function EditItemPanel({ category, itemId, form }: Props) {
  const { noun, title } = ITEM_COPY[category];
  const GONE = `That ${noun} no longer exists.`;
  const ctx = useCommandContext();
  const close = useMenu((s) => s.closeMenu);
  // undefined = still loading; null = missing or deleted.
  const item = useObservable<MapItemSnapshot | null | undefined>(() => observeItem(ctx.db, itemId), undefined, [ctx, itemId]);
  const hiddenIds = useObservable(() => observeHiddenItemIds(ctx.db), NO_IDS, [ctx]);
  const ready = useDraft((s) => s.mode === 'edit' && s.itemId === itemId);
  const coord = useDraft((s) => s.coord);
  const name = useDraft((s) => s.name);
  const coordInputValid = useDraft((s) => s.coordInputValid);
  // Opens view-only; Edit unlocks the form, Save or Cancel locks it again.
  const locked = useDraft((s) => s.locked);
  const started = useRef(false);
  // Set before we close or delete ourselves, so the item vanishing is not reported as "missing".
  const leaving = useRef(false);
  const busy = useRef(false);

  useEffect(() => {
    if (item === undefined || leaving.current) return;
    const at = item ? pointCoord(item.geometry) : null;
    if (!item || !at) {
      leaving.current = true;
      notifyError(GONE);
      close();
      return;
    }
    // Opened in the other category's menu (a stale link): hand over to the right one.
    if (itemCategory(item.sidc) !== category) {
      leaving.current = true;
      openItemMenu(item.id, item.sidc);
      return;
    }
    if (started.current) return;
    started.current = true;
    selectItem(item);
  }, [item, close, category, GONE]);

  useEffect(() => () => useDraft.getState().clear(), []);

  const canSave = ready && !locked && coord !== null && coordInputValid && name.trim() !== '';

  const save = async () => {
    if (busy.current || !canSave) return;
    busy.current = true;
    const d = useDraft.getState();
    let result;
    try {
      result = await updateItem(ctx, itemId, {
        coord: d.coord!,
        name: d.name,
        notes: d.notes.trim() || null,
        sidc: draftSidc(d),
      });
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
    if (item && !selectItem(item)) close();
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
          leading={{ label: 'Close', onPress: close }}
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
