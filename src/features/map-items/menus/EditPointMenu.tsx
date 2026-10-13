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
    const kind = (item.sidc ? decomposeSidc(item.sidc) : null) ?? { affiliation: 'unknown' as const, unitType: 'unspecified' as const };
    useDraft.getState().startEdit({ itemId: item.id, coord: at, affiliation: kind.affiliation, unitType: kind.unitType, name: item.name, notes: item.notes ?? '' });
  }, [item, close]);

  useEffect(() => () => useDraft.getState().clear(), []);

  const canSave = ready && coord !== null && coordInputValid && name.trim() !== '';

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
      leaving.current = true;
      notifySuccess();
      close();
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

  const setHidden = (hidden: boolean) => {
    void setItemHidden(ctx, params.itemId, hidden).then((result) => {
      if (!result.ok) notifyError('Could not change visibility.');
    });
  };

  return (
    <View>
      <MenuHeader
        title="Edit point"
        leading={{ label: 'Cancel', onPress: close }}
        trailing={{ label: 'Save', icon: 'check', onPress: () => void save(), disabled: !canSave }}
      />
      {ready ? (
        <>
          <PointForm missionId={missionId} mode="edit" />
          <MenuSection>
            <MenuToggle label="Hidden on map" value={hiddenIds.includes(params.itemId)} onValueChange={setHidden} />
          </MenuSection>
          <MenuActions destructive={{ label: 'Delete point', confirmLabel: 'Tap again to delete', onConfirm: () => void remove() }} />
        </>
      ) : null}
    </View>
  );
}

export const editPointMenu = defineMenu({ id: 'point.edit', family: 'action', title: 'Edit point', detents: ['peek', 'half', 'full'], component: EditPointMenu });
