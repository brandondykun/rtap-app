import { useState } from 'react';
import { Keyboard, Text, View } from 'react-native';

import { MenuButton } from '@/components/menu/MenuButton';
import { MenuHeader } from '@/components/menu/MenuHeader';
import { MenuListItem } from '@/components/menu/MenuListItem';
import { MenuSection } from '@/components/menu/MenuSection';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { TextField } from '@/components/ui/TextField';
import { notifyError } from '@/features/feedback/feedback';
import { defineMenu, type MenuComponentProps } from '@/features/menus/define-menu';
import { useCommandContext } from '@/lib/db/command-context-provider';
import { useMenu } from '@/stores/menu';

import { createOverlay, deleteOverlay, MAX_OVERLAY_NAME, renameOverlay, setOverlayHidden } from './commands';
import { setBaseHidden } from '@/features/missions/commands';

import type { Overlay } from './repository';
import { useBaseHidden, useMissionOverlays } from './use-mission-overlays';


/**
 * The mission's overlays: add one by name, show or hide each, tap one to rename it, delete one (its items stay, back in the
 * base unless in another overlay). Opened from Layers, whose Back it returns to.
 */
/** Under "There is already an overlay named …". */
const NAME_TAKEN_DETAIL = 'Choose a different name.';

export function OverlaysMenu({ missionId }: MenuComponentProps<'overlays'>) {
  const ctx = useCommandContext();
  const overlays = useMissionOverlays(missionId);
  const baseHidden = useBaseHidden(missionId);
  const back = useMenu((s) => s.back);
  const close = useMenu((s) => s.closeMenu);
  const drilled = useMenu((s) => s.stack.length > 1);
  const [newName, setNewName] = useState('');
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState<Overlay | null>(null);

  const add = async () => {
    if (!newName.trim()) return;
    const r = await createOverlay(ctx, { missionId, name: newName });
    if (!r.ok) {
      if (r.error === 'name_taken') notifyError(`There is already an overlay named ${newName.trim()}.`, NAME_TAKEN_DETAIL);
      else notifyError('Could not add the overlay.');
      return;
    }
    setNewName('');
  };
  const saveRename = async () => {
    if (!renaming) return;
    const r = await renameOverlay(ctx, renaming.id, renaming.name);
    if (!r.ok) {
      if (r.error === 'name_taken') notifyError(`There is already an overlay named ${renaming.name.trim()}.`, NAME_TAKEN_DETAIL);
      else notifyError('Could not rename the overlay.');
      return;
    }
    setRenaming(null);
    Keyboard.dismiss();
  };
  const confirmDelete = async () => {
    if (!deleting) return;
    const r = await deleteOverlay(ctx, deleting.id);
    if (!r.ok) return notifyError('Could not delete the overlay.');
    setDeleting(null);
  };

  return (
    <View className="pt-3">
      <MenuHeader
        title="Overlays"
        leading={drilled ? { label: 'Back', icon: 'chevron-left', iconOnly: true, onPress: back } : { label: 'Close', icon: 'close', iconOnly: true, onPress: close }}
      />
      <MenuSection>
        <Text className="text-sm text-text-muted">
          An overlay is a named group of map items, like the phases of an operation, that you turn on and off together. New
          items start in Base. To put an item in an overlay, tap the item on the map and choose under Overlays.
        </Text>
      </MenuSection>
      <MenuSection label="New overlay">
        <View className="flex-row items-center gap-2">
          <View className="flex-1">
            <TextField
              accessibilityLabel="New overlay name"
              clearable
              value={newName}
              onChangeText={setNewName}
              placeholder="e.g. Phase 1"
              maxLength={MAX_OVERLAY_NAME}
              returnKeyType="done"
              onSubmitEditing={() => void add()}
            />
          </View>
          <MenuButton label="Add overlay" text="Add" icon="plus" disabled={!newName.trim()} onPress={() => void add()} />
        </View>
      </MenuSection>
      <MenuSection label={`Overlays · ${overlays.length + 1}`}>
        <View>
          {/* Base: always there, first. Shown or hidden only; it cannot be renamed or deleted. */}
          <MenuListItem
            title="Base"
            subtitle="Items not in any other overlay"
            dimmed={baseHidden}
            onPress={() => {}}
            secondary={null}
            trailing={{
              icon: baseHidden ? 'eye-off-outline' : 'eye-outline',
              label: baseHidden ? 'Show Base' : 'Hide Base',
              onPress: () =>
                void setBaseHidden(ctx, missionId, !baseHidden).then((r) => {
                  if (!r.ok) notifyError('Could not change the overlay.');
                }),
            }}
          />
            {overlays.map((o) =>
              renaming?.id === o.id ? (
                <View key={o.id} testID={`overlay-rename-${o.id}`} className="flex-row items-center gap-2 border-t border-border py-2">
                  <View className="flex-1">
                    <TextField
                      accessibilityLabel={`Rename ${o.name}`}
                      clearable
                      autoFocus
                      value={renaming.name}
                      onChangeText={(name) => setRenaming({ id: o.id, name })}
                      maxLength={MAX_OVERLAY_NAME}
                      returnKeyType="done"
                      onSubmitEditing={() => void saveRename()}
                    />
                  </View>
                  <MenuButton label="Save name" text="Save" icon="check" disabled={!renaming.name.trim()} onPress={() => void saveRename()} />
                </View>
              ) : (
                <MenuListItem
                  key={o.id}
                  title={o.name}
                  subtitle={`${o.itemCount} ${o.itemCount === 1 ? 'item' : 'items'} · tap to rename`}
                  dimmed={o.hidden}
                  onPress={() => setRenaming({ id: o.id, name: o.name })}
                  secondary={{ icon: 'trash-can-outline', label: `Delete ${o.name}`, onPress: () => setDeleting(o) }}
                  trailing={{
                    icon: o.hidden ? 'eye-off-outline' : 'eye-outline',
                    label: o.hidden ? `Show ${o.name}` : `Hide ${o.name}`,
                    onPress: () =>
                      void setOverlayHidden(ctx, o.id, !o.hidden).then((r) => {
                        if (!r.ok) notifyError('Could not change the overlay.');
                      }),
                  }}
                />
              ),
            )}
        </View>
      </MenuSection>
      <ConfirmDialog
        visible={deleting !== null}
        title="Delete overlay?"
        message={deleting ? `Delete ${deleting.name}? Its items are not deleted. Any item that is not in another overlay moves back to Base.` : ''}
        confirmLabel="Delete"
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleting(null)}
      />
    </View>
  );
}

export const overlaysMenu = defineMenu({ id: 'overlays', family: 'app', title: 'Overlays', icon: 'layers-triple-outline', component: OverlaysMenu });
