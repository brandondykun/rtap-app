import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { MenuVertexRow } from '@/components/menu/MenuVertexRow';
import { Icon } from '@/components/ui/Icon';
import { formatCoordinate } from '@/features/map/interaction/readout';
import type { LatLon } from '@/lib/geo/types';
import { formatDistance } from '@/lib/geo/format/measure';
import { useDraft } from '@/stores/draft';
import { useSettings } from '@/stores/settings';
import { useTheme } from '@/theme/ThemeProvider';

import { segmentLengths } from '../../line-measure';

/** A collapsed "Points · n" row that opens the read-only list of the polygon's points; pressing one centers the map on it. */
export function PolygonPoints({ points }: { points: LatLon[] }) {
  const { colors } = useTheme();
  const coordinateFormat = useSettings((s) => s.coordinateFormat);
  const [open, setOpen] = useState(false);
  const segs = segmentLengths(points);
  return (
    <View className="overflow-hidden rounded-xl border border-border bg-surface-raised">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Points, ${points.length}`}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(!open)}
        className="active:opacity-60 flex-row items-center gap-3 px-3 py-3">
        <View className="flex-row">
          {[1, 2, 3].map((n) => (
            <View key={n} className={`h-5 w-5 items-center justify-center rounded-full bg-text ${n > 1 ? '-ml-1' : ''}`}>
              <Text className="text-xs font-bold text-surface-input">{n}</Text>
            </View>
          ))}
        </View>
        <Text className="shrink font-mono text-base text-text">{`Points · ${points.length}`}</Text>
        <View className="ml-auto flex-row items-center gap-1">
          <Text className="text-sm text-text-muted">View grids</Text>
          <Icon name={open ? 'chevron-up' : 'chevron-down'} size={20} color={colors['text-muted']} />
        </View>
      </Pressable>
      {open ? (
        <View>
          {points.map((p, i) => (
            <MenuVertexRow
              key={i}
              number={i + 1}
              title={formatCoordinate(p, coordinateFormat)}
              detail={i === 0 ? 'start' : `+${formatDistance(segs[i - 1])}`}
              onPress={() => useDraft.getState().lookAt(p)}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}
