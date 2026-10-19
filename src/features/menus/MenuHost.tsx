import { useEffect, type ComponentType } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Panel } from '@/components/menu/Panel';
import { EDGE, GAP } from '@/features/map/layout';
import { useToolbarHeight } from '@/features/toolbar/use-toolbar-height';
import { topMenu, useMenu } from '@/stores/menu';

import type { MenuComponentProps } from './define-menu';
import type { MenuId, MenuParams } from './params';
import { MENU_REGISTRY } from './registry';

/** Renders the top of the menu stack in the Panel. The map behind stays fully interactive. */
export function MenuHost({ landscape, missionId }: { landscape: boolean; missionId: string }) {
  const insets = useSafeAreaInsets();
  const toolbar = useToolbarHeight();
  const top = useMenu((s) => topMenu(s));
  const setPanelFrame = useMenu((s) => s.setPanelFrame);
  const minimized = useMenu((s) => s.panelMinimized);
  const setMinimized = useMenu((s) => s.setPanelMinimized);
  const definition = top ? MENU_REGISTRY[top.id] : undefined;

  useEffect(() => {
    if (top && !definition) console.error(`[menu] no menu registered for ${top.id}`);
    if (!definition) setPanelFrame(null);
  }, [top, definition, setPanelFrame]);

  if (!top || !definition) return null;
  const Component = definition.component as ComponentType<MenuComponentProps<MenuId>>;
  const initialDetent = definition.detents.includes('half') ? 'half' : definition.detents[0];
  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      <Panel
        landscape={landscape}
        detents={definition.detents}
        initialDetent={initialDetent}
        topReserved={insets.top + EDGE + toolbar + GAP}
        title={definition.title}
        minimized={minimized}
        onMinimizedChange={setMinimized}
        onFrameChange={setPanelFrame}>
        <Component key={`${top.id}:${JSON.stringify(top.params)}`} params={top.params as MenuParams<MenuId>} missionId={missionId} />
      </Panel>
    </View>
  );
}
