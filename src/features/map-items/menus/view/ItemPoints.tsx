import { memo, useDeferredValue, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { MenuVertexRow } from '@/components/menu/MenuVertexRow';
import { Icon } from '@/components/ui/Icon';
import { formatCoordinate } from '@/features/map/interaction/readout';
import type { LatLon } from '@/lib/geo/types';
import { formatDistance } from '@/lib/geo/format/measure';
import { useDraft } from '@/stores/draft';
import { useSettings, type CoordinateFormat } from '@/stores/settings';
import { useTheme } from '@/theme/ThemeProvider';

import { segmentLengths } from '../../line-measure';

/**
 * A collapsed "Points · n" row that opens the read-only list of a line or polygon's points; pressing one centers the map on
 * it. A long list is built in the background (a deferred render React can interrupt), so the tap answers at once instead
 * of freezing the app while dozens of rows are made.
 */
export function ItemPoints({ points }: { points: LatLon[] }) {
  const { colors } = useTheme();
  const coordinateFormat = useSettings((s) => s.coordinateFormat);
  const [open, setOpen] = useState(false);
  // Closing hides the list at once; opening shows it once the background render is done.
  const listOpen = useDeferredValue(open) && open;
  const segs = useMemo(() => segmentLengths(points), [points]);
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
      {listOpen ? (
        <View>
          {points.map((p, i) => (
            <PointRow key={i} index={i} lat={p.lat} lon={p.lon} segmentM={i === 0 ? null : segs[i - 1]} coordinateFormat={coordinateFormat} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

/** One point, by value: the item re-reading from the database (a new array of equal points) does not redraw the rows. */
const PointRow = memo(function PointRow({ index, lat, lon, segmentM, coordinateFormat }: { index: number; lat: number; lon: number; segmentM: number | null; coordinateFormat: CoordinateFormat }) {
  return (
    <MenuVertexRow
      number={index + 1}
      title={formatCoordinate({ lat, lon }, coordinateFormat)}
      detail={segmentM === null ? 'start' : `+${formatDistance(segmentM)}`}
      detailKind={segmentM === null ? undefined : 'distance'}
      onPress={() => useDraft.getState().lookAt({ lat, lon })}
    />
  );
});
