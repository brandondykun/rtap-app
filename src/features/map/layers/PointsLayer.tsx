import { ShapeSource, SymbolLayer } from '@rnmapbox/maps';
import { useMemo, type ComponentProps } from 'react';

import { observeHiddenItemIds, observeMissionItems, type MapItemSnapshot } from '@/features/map-items/repository';
import { createPointFeatureSelector, hiddenFilter } from '@/features/map-items/selectors';
import { useObservable } from '@/hooks/use-observable';
import { useCommandContext } from '@/lib/db/command-context-provider';
import type { LatLon } from '@/lib/geo/types';
import { useTheme } from '@/theme/ThemeProvider';

import { makePointLabelStyle, POINT_SYMBOL_STYLE } from './styles';

type LayerFilter = ComponentProps<typeof SymbolLayer>['filter'];

const NO_ITEMS: MapItemSnapshot[] = [];
const NO_IDS: string[] = [];

/** All mission points in one ShapeSource; hidden items are filtered out, never removed. */
/** `at` is where the user tapped (used when picking a location on the map). */
type Props = { missionId: string; excludeId?: string | null; onItemPress?: (id: string, at: LatLon, sidc: string | null) => void };

export function PointsLayer({ missionId, excludeId = null, onItemPress }: Props) {
  const ctx = useCommandContext();
  const { colors } = useTheme();
  const items = useObservable(() => observeMissionItems(ctx.db, missionId), NO_ITEMS, [ctx, missionId]);
  const hiddenIds = useObservable(() => observeHiddenItemIds(ctx.db), NO_IDS, [ctx]);
  const select = useMemo(() => createPointFeatureSelector(), []);
  const shape = useMemo(() => select(items), [select, items]);
  const filter = useMemo(() => hiddenFilter(excludeId ? [...hiddenIds, excludeId] : hiddenIds) as unknown as LayerFilter, [hiddenIds, excludeId]);
  const labelStyle = useMemo(() => makePointLabelStyle(colors), [colors]);

  return (
    <ShapeSource
      id="points"
      shape={shape}
      onPress={(e) => {
        const props = e.features[0]?.properties;
        const id = props?.id;
        const sidc = typeof props?.sidc === 'string' ? props.sidc : null;
        if (typeof id === 'string') onItemPress?.(id, { lat: e.coordinates.latitude, lon: e.coordinates.longitude }, sidc);
      }}>
      <SymbolLayer id="points-symbols" style={POINT_SYMBOL_STYLE} filter={filter} />
      <SymbolLayer id="points-labels" style={labelStyle} filter={filter} />
    </ShapeSource>
  );
}
