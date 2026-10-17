import { Pressable, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MenuButton } from '@/components/menu/MenuButton';
import { Icon } from '@/components/ui/Icon';
import { formatCoordinate } from '@/features/map/interaction/readout';
import { EDGE, selfCardClearance } from '@/features/map/layout';
import { useMapChrome } from '@/stores/map-chrome';
import { useMenu } from '@/stores/menu';
import { useQuickPlot } from '@/stores/quick-plot';
import { useTheme } from '@/theme/ThemeProvider';

const LANDSCAPE_WIDTH = 720;

/** Bottom card for the temporary point: TEMP + grid, Discard, Save unit, Save point. */
export function QuickPlotCard({ landscape }: { landscape: boolean }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { colors } = useTheme();
  const temp = useQuickPlot((s) => s.temp);
  const clearance = selfCardClearance(useMapChrome((s) => s.selfCard), landscape);
  if (!temp) return null;
  // Beside your grid card in landscape, above it in portrait; clear of the zoom column either way.
  const left = insets.left + EDGE;
  const right = insets.right + EDGE + clearance.right;
  const available = width - left - right;
  const cardWidth = landscape ? Math.min(LANDSCAPE_WIDTH, available) : available;

  const save = (id: 'unit.add' | 'point.add') => {
    useQuickPlot.getState().close();
    useMenu.getState().openMenu(id, { at: temp });
  };

  const grid = (
    <View className="shrink flex-row items-center gap-3">
      <View className="rounded-md border border-accent px-2 py-0.5">
        <Text className="text-xs font-bold tracking-widest text-accent">TEMP</Text>
      </View>
      <Text numberOfLines={1} adjustsFontSizeToFit className="shrink font-mono text-xl font-semibold text-text">
        {formatCoordinate(temp, 'mgrs')}
      </Text>
    </View>
  );
  const discard = <MenuButton label="Discard" icon="trash-can-outline" iconOnly onPress={() => useQuickPlot.getState().close()} />;
  const saveUnit = <MenuButton label="Save unit" icon="rhombus-outline" active onPress={() => save('unit.add')} />;
  const savePoint = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Save point"
      onPress={() => save('point.add')}
      className="flex-row items-center justify-center gap-2 rounded-xl bg-accent px-3 py-3">
      <Icon name="map-marker-outline" size={18} color={colors['on-accent']} />
      <Text style={{ color: colors['on-accent'] }} className="font-semibold">
        Save point
      </Text>
    </Pressable>
  );

  return (
    <View testID="quick-plot-card-slot" pointerEvents="box-none" className="absolute items-center" style={{ bottom: insets.bottom + EDGE + clearance.lift, left, right }}>
      <View testID="quick-plot-card" style={{ width: cardWidth }} className="gap-3 rounded-2xl border border-accent bg-surface-chrome p-3">
        {landscape ? (
          // Landscape: one compact line.
          <View testID="quick-plot-card-row" className="flex-row items-center gap-2">
            <View className="flex-1">{grid}</View>
            <View style={{ width: 140 }}>{saveUnit}</View>
            <View style={{ width: 150 }}>{savePoint}</View>
            {discard}
          </View>
        ) : (
          <>
            {grid}
            <View className="flex-row gap-2">
              <View className="flex-1">{saveUnit}</View>
              <View className="flex-1">{savePoint}</View>
              {discard}
            </View>
          </>
        )}
      </View>
    </View>
  );
}
