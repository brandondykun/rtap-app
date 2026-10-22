import { Pressable, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MenuButton } from '@/components/menu/MenuButton';
import type { PanelFrame } from '@/components/menu/panel-geometry';
import { glassHalo } from '@/components/ui/glass';
import { Icon } from '@/components/ui/Icon';
import { formatCoordinate } from '@/features/map/interaction/readout';
import { EDGE, selfCardClearance } from '@/features/map/layout';
import { useMapChrome } from '@/stores/map-chrome';
import { useMenu } from '@/stores/menu';
import { useQuickPlot } from '@/stores/quick-plot';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * Bottom card for the temporary point: TEMP + grid on its own line, then compact Save unit, Save point and Discard (like the
 * other map bars), as wide as its content. `panel` is the open menu panel, which the card keeps clear of in landscape.
 */
export function QuickPlotCard({ landscape, panel = null }: { landscape: boolean; panel?: PanelFrame | null }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { colors } = useTheme();
  const temp = useQuickPlot((s) => s.temp);
  const clearance = selfCardClearance(useMapChrome((s) => s.selfCard), landscape);
  if (!temp) return null;
  // Landscape: flush bottom left in the center card's spot (right of a drawer, like MapBottomLeft), beside your card.
  // Portrait: centered on the screen above your card, as far in from the left as the zoom column keeps it from the right.
  const right = insets.right + EDGE + clearance.right;
  const left = landscape ? Math.max(insets.left, panel?.side === 'left' ? panel.size : 0) + EDGE : insets.left + EDGE + clearance.right;
  const available = width - left - right;

  const save = (id: 'unit.add' | 'point.add') => {
    useQuickPlot.getState().close();
    useMenu.getState().openMenu(id, { at: temp });
  };

  const grid = (
    <View className="flex-row items-center gap-3 px-1 pt-0.5">
      <View className="rounded-md border border-accent px-2 py-0.5">
        <Text style={glassHalo(colors)} className="text-xs font-bold tracking-widest text-accent">
          TEMP
        </Text>
      </View>
      <Text numberOfLines={1} adjustsFontSizeToFit style={glassHalo(colors)} className="shrink font-mono text-xl font-semibold text-text">
        {formatCoordinate(temp, 'mgrs')}
      </Text>
    </View>
  );
  const discard = <MenuButton compact label="Discard" icon="trash-can-outline" iconOnly onPress={() => useQuickPlot.getState().close()} />;
  const saveUnit = <MenuButton compact label="Save unit" icon="rhombus-outline" active onPress={() => save('unit.add')} />;
  const savePoint = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Save point"
      onPress={() => save('point.add')}
      // Sized like a compact MenuButton.
      hitSlop={{ top: 4, bottom: 4, left: 3, right: 3 }}
      className="active:opacity-60 min-h-10 flex-row items-center justify-center gap-1.5 rounded-lg bg-accent px-3 py-2">
      <Icon name="map-marker-outline" size={16} color={colors['on-accent']} />
      <Text style={{ color: colors['on-accent'] }} className="text-sm font-semibold">
        Save point
      </Text>
    </Pressable>
  );

  return (
    <View testID="quick-plot-card-slot" pointerEvents="box-none" className={`absolute ${landscape ? 'items-start' : 'items-center'}`} style={{ bottom: insets.bottom + EDGE + clearance.lift, left, right }}>
      {/* 16 pt corners less the 1 pt border and 7 pt padding are the buttons' 8 pt (rounded-lg): concentric, as in the other map bars. */}
      <View testID="quick-plot-card" style={{ maxWidth: available }} className="gap-2 rounded-2xl border border-accent bg-surface-glass p-[7px]">
        {grid}
        <View testID="quick-plot-card-buttons" className="flex-row gap-1.5">
          {/* Each button only as wide as its label, to cover less of the map. */}
          <View>{saveUnit}</View>
          <View>{savePoint}</View>
          <View>{discard}</View>
        </View>
      </View>
    </View>
  );
}
