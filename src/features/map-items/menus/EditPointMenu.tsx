import { useEffect, useRef } from 'react';
import { View } from 'react-native';

import { MenuActions } from '@/components/menu/MenuActions';
import { MenuHeader } from '@/components/menu/MenuHeader';
import { MenuSection } from '@/components/menu/MenuSection';
import { MenuToggle } from '@/components/menu/MenuToggle';
import { notifyError, notifySuccess } from '@/features/feedback/feedback';
import { defineMenu, type MenuComponentProps } from '@/features/menus/define-menu';
import { composeSidc, decomposeSidc } from '@/features/symbology/presets';
import { useObservable } from '@/hooks/use-observable';
import { useCommandContext } from '@/lib/db/command-context-provider';
import { useDraft } from '@/stores/draft';
import { useMenu } from '@/stores/menu';

import { deleteItem, setItemHidden, updateItem } from '../commands';
import { pointCoord } from '../geometry';
import { observeHiddenItemIds, observeItem, type MapItemSnapshot } from '../repository';
import { PointForm } from './PointForm';

const GONE = 'That point no longer exists.';

/** Loads an item into the draft, selected and read-only. False when its geometry is unreadable. */
function selectItem(item: MapItemSnapshot): boolean {
  const at = pointCoord(item.geometry);
  if (!at) return false;
  const kind = (item.sidc ? decomposeSidc(item.sidc) : null) ?? { affiliation: 'unknown' as const, unitType: 'unspecified' as const };
  useDraft.getState().startEdit({ itemId: item.id, coord: at, category: 'unit', pointType: 'checkpoint', affiliation: kind.affiliation, unitType: kind.unitType, name: item.name, notes: item.notes ?? '' });
  return true;
}
const NO_IDS: string[] = [];

export function EditPointMenu({ params, missionId }: MenuComponentProps<'point.edit'>) {
  const ctx = useCommandContext();
  const close = useMenu((s) => s.closeMenu);
  // undefined = still loading; null = missing or deleted.
  const item = useObservable<MapItemSnapshot | null | undefined>(() => observeItem(ctx.db, params.itemId), undefined, [ctx, params.itemId]);
  const hiddenIds = useObservable(() => observeHiddenItemIds(ctx.db), NO_IDS, [ctx]);
  const ready = useDraft((s) => s.mode === 'edit' && s.itemId === params.itemId);
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
    if (started.current) return;
    started.current = true;
    selectItem(item);
  }, [item, close]);

  useEffect(() => () => useDraft.getState().clear(), []);

  const canSave = ready && !locked && coord !== null && coordInputValid && name.trim() !== '';

  const save = async () => {
    if (busy.current || !canSave) return;
    busy.current = true;
    const d = useDraft.getState();
    let result;
    try {
      result = await updateItem(ctx, params.itemId, {
        coord: d.coord!,
        name: d.name,
        notes: d.notes.trim() || null,
        sidc: composeSidc(d.affiliation, d.unitType),
      });
    } finally {
      busy.current = false;
    }
    if (result.ok) {
      notifySuccess();
      // Back to the view-only point; the draft already holds what was saved.
      useDraft.getState().setLocked(true);
    } else if (result.error === 'not_found') {
      leaving.current = true;
      notifyError(GONE);
      close();
    } else {
      notifyError(result.error === 'invalid_name' ? 'Enter a name.' : 'Could not save the point.');
    }
  };

  const remove = async () => {
    if (busy.current) return;
    busy.current = true;
    leaving.current = true;
    let result;
    try {
      result = await deleteItem(ctx, params.itemId);
    } finally {
      busy.current = false;
    }
    if (result.ok) {
      notifySuccess();
      close();
    } else {
      leaving.current = false;
      notifyError('Could not delete the point.');
    }
  };

  /** Cancel editing: drop the changes and show the saved point again, read-only. */
  const cancelEdit = () => {
    if (item && !selectItem(item)) close();
  };

  const setHidden = (hidden: boolean) => {
    void setItemHidden(ctx, params.itemId, hidden).then((result) => {
      if (!result.ok) notifyError('Could not change visibility.');
    });
  };

  return (
    <View>
      {locked ? (
        <MenuHeader
          title="Point"
          leading={{ label: 'Close', onPress: close }}
          trailing={{ label: 'Edit', icon: 'pencil', onPress: () => useDraft.getState().setLocked(false), disabled: !ready }}
        />
      ) : (
        <MenuHeader
          title="Edit point"
          leading={{ label: 'Cancel', onPress: cancelEdit }}
          trailing={{ label: 'Save', icon: 'check', onPress: () => void save(), disabled: !canSave }}
        />
      )}
      {ready ? (
        <>
          <PointForm missionId={missionId} mode="edit" />
          <MenuSection>
            <MenuToggle label="Hidden on map" value={hiddenIds.includes(params.itemId)} onValueChange={setHidden} disabled={locked} />
          </MenuSection>
          <MenuActions disabled={locked} destructive={{ label: 'Delete point', confirmLabel: 'Tap again to delete', onConfirm: () => void remove() }} />
        </>
      ) : null}
    </View>
  );
}

export const editPointMenu = defineMenu({ id: 'point.edit', family: 'action', title: 'Edit point', detents: ['peek', 'half', 'full'], component: EditPointMenu });
