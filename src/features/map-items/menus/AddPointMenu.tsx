import { useEffect, useRef } from 'react';
import { View } from 'react-native';

import { MenuHeader } from '@/components/menu/MenuHeader';
import { notifyError, notifySuccess } from '@/features/feedback/feedback';
import { defineMenu, type MenuComponentProps } from '@/features/menus/define-menu';
import { composeSidc } from '@/features/symbology/presets';
import { useCommandContext } from '@/lib/db/command-context-provider';
import { useDraft } from '@/stores/draft';
import { useInteraction } from '@/stores/interaction';
import { useMenu } from '@/stores/menu';

import { placePoint } from '../commands';
import { PointForm } from './PointForm';

export function AddPointMenu({ params, missionId }: MenuComponentProps<'point.add'>) {
  const ctx = useCommandContext();
  const close = useMenu((s) => s.closeMenu);
  const coord = useDraft((s) => s.coord);
  const name = useDraft((s) => s.name);
  const coordInputValid = useDraft((s) => s.coordInputValid);
  // A ref, not state: a second tap in the same frame must see the first tap's lock.
  const busy = useRef(false);

  useEffect(() => {
    const at = params.at ?? useInteraction.getState().cameraCenter;
    useDraft.getState().startAdd({ coord: at, source: params.at ? 'press' : 'crosshair' });
    return () => useDraft.getState().clear();
    // Opened once per panel; later long-presses move the draft instead of reopening.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canAdd = coord !== null && coordInputValid && name.trim() !== '';

  const add = async () => {
    if (busy.current || !canAdd) return;
    busy.current = true;
    const d = useDraft.getState();
    const result = await placePoint(ctx, {
      missionId,
      coord: d.coord!,
      sidc: composeSidc(d.affiliation, d.unitType),
      name: d.name,
      notes: d.notes.trim() || null,
    });
    busy.current = false;
    if (!result.ok) {
      notifyError(result.error === 'invalid_name' ? 'Enter a name.' : 'Could not add the point.');
      return;
    }
    notifySuccess();
    // Rapid entry: keep affiliation and type, start the next point at the crosshair.
    useDraft.getState().resetAfterAdd(useInteraction.getState().cameraCenter);
  };

  return (
    <View>
      <MenuHeader
        title="Add point"
        leading={{ label: 'Cancel', onPress: close }}
        trailing={{ label: 'Add', icon: 'check', onPress: () => void add(), disabled: !canAdd }}
      />
      <PointForm missionId={missionId} mode="add" />
    </View>
  );
}

export const addPointMenu = defineMenu({ id: 'point.add', family: 'action', title: 'Add point', detents: ['peek', 'half', 'full'], component: AddPointMenu });
