import { Pressable, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MenuButton } from '@/components/menu/MenuButton';
import { Icon } from '@/components/ui/Icon';
import { formatCoordinate } from '@/features/map/interaction/readout';
import { EDGE } from '@/features/map/layout';
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
  if (!temp) return null;
  const full = width - insets.left - insets.right - 2 * EDGE;
  const cardWidth = landscape ? Math.min(LANDSCAPE_WIDTH, full) : full;

  const save = (id: 'unit.add' | 'point.add') => {
    useQuickPlot.getState().close();
    useMenu.getState().openMenu(id, { at: temp });
  };

  return (
    <View pointerEvents="box-none" className="absolute left-0 right-0 items-center" style={{ bottom: insets.bottom + EDGE }}>
      <View testID="quick-plot-card" style={{ width: cardWidth }} className="gap-3 rounded-2xl border border-accent bg-surface-chrome p-3">
        <View className="flex-row items-center gap-3">
          <View className="rounded-md border border-accent px-2 py-0.5">
            <Text className="text-xs font-bold tracking-widest text-accent">TEMP</Text>
          </View>
          <Text numberOfLines={1} adjustsFontSizeToFit className="shrink font-mono text-xl font-semibold text-text">
            {formatCoordinate(temp, 'mgrs')}
          </Text>
        </View>
        <View className="flex-row gap-2">
          <View className="flex-1">
            <MenuButton label="Discard" icon="trash-can-outline" onPress={() => useQuickPlot.getState().close()} />
          </View>
          <View className="flex-1">
            <MenuButton label="Save unit" icon="rhombus-outline" active onPress={() => save('unit.add')} />
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Save point"
            onPress={() => save('point.add')}
            className="flex-1 flex-row items-center justify-center gap-2 rounded-xl bg-accent px-3 py-3">
            <Icon name="map-marker-outline" size={18} color={colors['on-accent']} />
            <Text style={{ color: colors['on-accent'] }} className="font-semibold">
              Save point
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
