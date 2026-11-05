import { useContext, useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { MenuHeader } from '@/components/menu/MenuHeader';
import { PanelScrollContext } from '@/components/menu/panel-header-slot';
import { notifyError, notifySuccess } from '@/features/feedback/feedback';
import { ItemOverlaysSection } from '@/features/overlays/ItemOverlaysSection';
import { itemCategory, type ItemCategory } from '@/features/symbology/categories';
import { useObservable } from '@/hooks/use-observable';
import { useCommandContext } from '@/lib/db/command-context-provider';
import { draftRanges, useDraft } from '@/stores/draft';
import { useMenu } from '@/stores/menu';
import { useTheme } from '@/theme/ThemeProvider';

import { deleteItem } from '../commands';
import { observeHiddenItemIds, observeItem, peekMissionItem, type MapItemSnapshot } from '../repository';
import { formatRangeText, RANGE_FIELDS } from '../unit-ranges';
import { ITEM_ADAPTERS } from './item-adapters';
import { ITEM_COPY, openItemMenu } from './item-menus';
import { ItemView } from './view/ItemView';
import { LineView } from './view/LineView';
import { PolygonView } from './view/PolygonView';

const NO_IDS: string[] = [];

type Props = { category: ItemCategory; itemId: string; missionId: string; form: ReactNode };

/**
 * Item view: every item opens as a condensed view (Edit unlocks the form). Save or Cancel locks it again. Tapping the
 * notes edits just them, in place in the view, with Cancel / Save in the header.
 */
export function EditItemPanel({ category, itemId, missionId, form }: Props) {
  const { noun, title } = ITEM_COPY[category];
  const { colors } = useTheme();
  const adapter = ITEM_ADAPTERS[category];
  const GONE = `That ${noun} no longer exists.`;
  const ctx = useCommandContext();
  const closeMenu = useMenu((s) => s.closeMenu);
  const back = useMenu((s) => s.back);
  // Drilled into from another menu (Layers): leaving goes back there instead of closing.
  const drilled = useMenu((s) => s.stack.length > 1);
  const close = drilled ? back : closeMenu;
  // undefined = still loading; null = missing or deleted. It starts from the map's copy of the item (when the map has it),
  // so the menu opens with its details instead of empty until its own query answers.
  const item = useObservable<MapItemSnapshot | null | undefined>(() => observeItem(ctx.db, itemId), peekMissionItem(ctx.db, missionId, itemId), [ctx, itemId]);
  const hiddenIds = useObservable(() => observeHiddenItemIds(ctx.db), NO_IDS, [ctx]);
  const ready = useDraft((s) => s.mode === 'edit' && s.itemId === itemId);
  const valid = useDraft((s) => adapter.canSave(s));
  // Opens view-only; Edit unlocks the form, Save or Cancel locks it again.
  const locked = useDraft((s) => s.locked);
  // Only the notes open, in place in the view (tapping them there): Cancel / Save without leaving the view.
  const notesEditing = useDraft((s) => s.notesEditing);
  const started = useRef(false);
  // Set before we close or delete ourselves, so the item vanishing is not reported as "missing".
  const leaving = useRef(false);
  const busy = useRef(false);

  // Before the first paint: an item already at hand (the map's copy) is shown in the very first frame, not after an empty one.
  useLayoutEffect(() => {
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

  // A layout effect, like the selecting one above: when another item's menu replaces this one, this clears the draft before
  // that menu fills it. (A plain effect's clean-up would run after, wiping the new item.)
  useLayoutEffect(() => () => useDraft.getState().clear(), []);

  // Saving or cancelling swaps the long form for the short view: start it at the top, not part-way down.
  const panelScroll = useContext(PanelScrollContext);
  // Only once the item is loaded: loading it locks the draft too, and that must not move the menu.
  const wasLocked = useRef(true);
  useEffect(() => {
    if (!ready) return;
    if (locked && !wasLocked.current) panelScroll?.scrollToTop();
    wasLocked.current = locked;
  }, [ready, locked, panelScroll]);

  const canSave = ready && (!locked || notesEditing) && valid;

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
      // Back to the view-only item. The range fields show what was stored (rounded, or cleared by a type change), not what was typed.
      const saved = draftRanges(d);
      for (const f of RANGE_FIELDS) useDraft.getState().setRangeText(f, formatRangeText(saved?.[f] ?? null));
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

  const hidden = hiddenIds.includes(itemId);

  return (
    <View>
      {notesEditing ? (
        <MenuHeader
          title={title}
          leading={{ label: 'Cancel', onPress: () => useDraft.getState().stopEditingNotes(item?.notes ?? '') }}
          trailing={{ label: 'Save', icon: 'check', onPress: () => void save(), disabled: !canSave }}
        />
      ) : locked ? (
        <MenuHeader
          title={title}
          leading={drilled ? { label: 'Back', icon: 'chevron-left', iconOnly: true, onPress: back } : { label: 'Close', icon: 'close', iconOnly: true, onPress: closeMenu }}
          trailing={{ label: 'Edit', icon: 'pencil', onPress: () => useDraft.getState().setLocked(false), disabled: !ready }}
        />
      ) : (
        <MenuHeader
          title={`Edit ${noun}`}
          leading={{ label: 'Cancel', onPress: cancelEdit }}
          trailing={{ label: 'Save', icon: 'check', onPress: () => void save(), disabled: !canSave }}
        />
      )}
      {ready ? locked ? item ? (
        <>
          {category === 'line' ? (
            <LineView item={item} hidden={hidden} onEditNotes={() => useDraft.getState().editNotes()} onDelete={() => void remove()} />
          ) : category === 'polygon' ? (
            <PolygonView item={item} hidden={hidden} onEditNotes={() => useDraft.getState().editNotes()} onDelete={() => void remove()} />
          ) : (
            <ItemView category={category} item={item} hidden={hidden} onEditNotes={() => useDraft.getState().editNotes()} onDelete={() => void remove()} />
          )}
          <ItemOverlaysSection missionId={missionId} itemId={itemId} />
        </>
      ) : null : (
        // A little room between the header's Cancel / Save and the first field.
        <View testID="edit-form" className="pt-3">
          {form}
        </View>
      ) : (
        // Still reading the item (one the map did not have at hand): say so rather than open empty.
        <View testID="item-loading" className="items-center py-10">
          <ActivityIndicator accessibilityLabel={`Loading the ${noun}`} color={colors['text-muted']} />
        </View>
      )}
    </View>
  );
}
