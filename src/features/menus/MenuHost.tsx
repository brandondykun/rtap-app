import { useEffect, type ComponentType } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useShallow } from 'zustand/react/shallow';

import { Panel } from '@/components/menu/Panel';
import { MENU_DETENTS, MENU_INITIAL_DETENT } from '@/components/menu/panel-geometry';
import { EDGE, GAP, HINT_BAR_HEIGHT } from '@/features/map/layout';
import { useToolbarHeight } from '@/features/toolbar/use-toolbar-height';
import { useDraft } from '@/stores/draft';
import { topMenu, useMenu } from '@/stores/menu';

import type { MenuComponentProps } from './define-menu';
import { recallForEntry, rememberForEntry } from './menu-entry-memory';
import { minimizedSummary } from './minimized-summary';
import type { MenuId, MenuParams } from './params';
import { MENU_REGISTRY } from './registry';

/**
 * Space a full-height sheet leaves at the top: the safe area and the toolbar. Editing a line or polygon in portrait the
 * "Tap map" bar sits on top of the sheet, so the sheet stops short by the bar too and the bar never reaches the toolbar.
 */
export function menuTopReserved({ insetTop, toolbar, drawing, landscape }: { insetTop: number; toolbar: number; drawing: boolean; landscape: boolean }): number {
  return insetTop + EDGE + toolbar + GAP + (drawing && !landscape ? HINT_BAR_HEIGHT + EDGE : 0);
}

/** Renders the top of the menu stack in the Panel. The map behind stays fully interactive. */
export function MenuHost({ landscape, missionId }: { landscape: boolean; missionId: string }) {
  const insets = useSafeAreaInsets();
  const toolbar = useToolbarHeight();
  const top = useMenu((s) => topMenu(s));
  const setPanelFrame = useMenu((s) => s.setPanelFrame);
  const minimized = useMenu((s) => s.panelMinimized);
  const draft = useDraft(useShallow((d) => ({ mode: d.mode, category: d.category, name: d.name, vertices: d.vertices, polygonShape: d.polygonShape })));
  const setMinimized = useMenu((s) => s.setPanelMinimized);
  const drawing = useDraft((d) => (d.category === 'line' || d.category === 'polygon') && d.mode !== null && !d.locked);
  const definition = top ? MENU_REGISTRY[top.id] : undefined;

  useEffect(() => {
    if (top && !definition) console.error(`[menu] no menu registered for ${top.id}`);
    if (!definition) setPanelFrame(null);
  }, [top, definition, setPanelFrame]);

  if (!top || !definition) return null;
  const Component = definition.component as ComponentType<MenuComponentProps<MenuId>>;
  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      <Panel
        landscape={landscape}
        detents={MENU_DETENTS}
        initialDetent={MENU_INITIAL_DETENT}
        topReserved={menuTopReserved({ insetTop: insets.top, toolbar, drawing, landscape })}
        title={definition.title}
        minimized={minimized}
        minimizedTab={{ icon: definition.icon, ...minimizedSummary(top.id, definition.title, draft) }}
        onMinimizedChange={setMinimized}
        onFrameChange={setPanelFrame}
        contentKey={top}
        restoreScrollY={recallForEntry<number>(top, 'scrollY')}
        onScrollY={(y) => rememberForEntry(top, 'scrollY', y)}
        ownScroll={definition.ownScroll}
        growOnly={definition.growOnly}>
        <Component key={`${top.id}:${JSON.stringify(top.params)}`} params={top.params as MenuParams<MenuId>} missionId={missionId} />
      </Panel>
    </View>
  );
}
