import { Text, View } from 'react-native';

import { Icon, type IconName } from '@/components/ui/Icon';
import type { SemanticToken } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';

import { formatCategoryCounts } from '../format';
import type { CategoryCounts } from '../repository';

const CATEGORIES: readonly { key: keyof CategoryCounts; icon: IconName; label: string; color: SemanticToken }[] = [
  { key: 'units', icon: 'rhombus-outline', label: 'UNITS', color: 'friendly' },
  { key: 'points', icon: 'map-marker-outline', label: 'POINTS', color: 'accent' },
  { key: 'lines', icon: 'vector-polyline', label: 'LINES', color: 'text-muted' },
  { key: 'polygons', icon: 'pentagon-outline', label: 'POLYGONS', color: 'hostile' },
];

/** Compact counts for a list card: icon and number per category. */
export function CountsRow({ counts }: { counts: CategoryCounts }) {
  const { colors } = useTheme();
  return (
    <View accessible accessibilityLabel={formatCategoryCounts(counts)} className="flex-row items-center gap-4">
      {CATEGORIES.map((c) => (
        <View key={c.key} className="flex-row items-center gap-1">
          <Icon name={c.icon} size={16} color={colors[c.color]} />
          <Text className="font-semibold text-text">{counts[c.key]}</Text>
        </View>
      ))}
    </View>
  );
}

/** The pinned card's stats: icon and large number over a spaced label. */
export function StatsRow({ counts }: { counts: CategoryCounts }) {
  const { colors } = useTheme();
  return (
    <View accessible accessibilityLabel={formatCategoryCounts(counts)} className="flex-row">
      {CATEGORIES.map((c) => (
        <View key={c.key} className="flex-1 gap-1">
          <View className="flex-row items-center gap-2">
            <Icon name={c.icon} size={18} color={colors[c.color]} />
            <Text className="text-2xl font-bold text-text">{counts[c.key]}</Text>
          </View>
          <Text className="text-xs font-semibold tracking-widest text-text-muted">{c.label}</Text>
        </View>
      ))}
    </View>
  );
}
