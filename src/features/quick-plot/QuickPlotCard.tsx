import { Pressable, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MenuButton } from '@/components/menu/MenuButton';
import { glassHalo } from '@/components/ui/glass';
import { Icon } from '@/components/ui/Icon';
import { formatCoordinate } from '@/features/map/interaction/readout';
import { EDGE, selfCardClearance } from '@/features/map/layout';
import { useMapChrome } from '@/stores/map-chrome';
import { useMenu } from '@/stores/menu';
import { useQuickPlot } from '@/stores/quick-plot';
import { useTheme } from '@/theme/ThemeProvider';

/** Wide enough for the grid at full size; the compact buttons share the row under it. */
const LANDSCAPE_WIDTH = 400;

/** Bottom card for the temporary point: TEMP + grid on its own line, then compact Save unit, Save point and Discard (like the other map bars). */
export function QuickPlotCard({ landscape }: { landscape: boolean }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { colors } = useTheme();
  const temp = useQuickPlot((s) => s.temp);
  const clearance = selfCardClearance(useMapChrome((s) => s.selfCard), landscape);
  if (!temp) return null;
  // Beside your card (bottom right) in landscape, above it in portrait; clear of the zoom column either way.
  const left = insets.left + EDGE;
  const right = insets.right + EDGE + clearance.right;
  const available = width - left - right;
  const cardWidth = landscape ? Math.min(LANDSCAPE_WIDTH, available) : available;

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
    <View testID="quick-plot-card-slot" pointerEvents="box-none" className="absolute items-center" style={{ bottom: insets.bottom + EDGE + clearance.lift, left, right }}>
      {/* 16 pt corners less the 1 pt border and 7 pt padding are the buttons' 8 pt (rounded-lg): concentric, as in the other map bars. */}
      <View testID="quick-plot-card" style={{ width: cardWidth }} className="gap-2 rounded-2xl border border-accent bg-surface-glass p-[7px]">
        {grid}
        <View testID="quick-plot-card-buttons" className="flex-row gap-1.5">
          <View className="flex-1">{saveUnit}</View>
          <View className="flex-1">{savePoint}</View>
          {discard}
        </View>
      </View>
    </View>
  );
}
