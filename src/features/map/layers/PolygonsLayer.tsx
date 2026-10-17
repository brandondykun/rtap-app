import { FillLayer, LineLayer, ShapeSource, SymbolLayer } from '@rnmapbox/maps';
import { useMemo, type ComponentProps } from 'react';

import { createPolygonFeatureSelector } from '@/features/map-items/polygon-selectors';
import { observeHiddenItemIds, observeMissionItems, type MapItemSnapshot } from '@/features/map-items/repository';
import { hiddenFilter } from '@/features/map-items/selectors';
import type { ItemRef } from '@/features/symbology/categories';
import { useObservable } from '@/hooks/use-observable';
import { useCommandContext } from '@/lib/db/command-context-provider';
import type { LatLon } from '@/lib/geo/types';
import { useSettings } from '@/stores/settings';
import { useTheme } from '@/theme/ThemeProvider';

import { makeLineDashedStyle, makeLineHaloStyle, makeLineStyle, makePolygonFillStyle, makePolygonLabelStyle } from './styles';
import { useLabelTextSize } from './use-label-text-size';

type Filter = ComponentProps<typeof LineLayer>['filter'];
const NO_ITEMS: MapItemSnapshot[] = [];
const NO_IDS: string[] = [];
const all = (...parts: unknown[]) => ['all', ...parts] as unknown as Filter;
const OUTLINE = ['==', ['get', 'role'], 'outline'];

type Props = { missionId: string; excludeId?: string | null; onItemPress?: (id: string, at: LatLon, item: ItemRef) => void };

/** Saved polygons: a light fill (not tappable, so taps inside reach the map), then outline and label (tappable). */
export function PolygonsLayer({ missionId, excludeId = null, onItemPress }: Props) {
  const ctx = useCommandContext();
  const { colors } = useTheme();
  const showLabels = useSettings((s) => s.showMapLabels);
  const labelSize = useLabelTextSize();
  const items = useObservable(() => observeMissionItems(ctx.db, missionId), NO_ITEMS, [ctx, missionId]);
  const hiddenIds = useObservable(() => observeHiddenItemIds(ctx.db), NO_IDS, [ctx]);
  const select = useMemo(() => createPolygonFeatureSelector(), []);
  const { fills, shapes } = useMemo(() => select(items), [select, items]);
  const visible = useMemo(() => hiddenFilter(excludeId ? [...hiddenIds, excludeId] : hiddenIds), [hiddenIds, excludeId]);
  const styles = useMemo(
    () => ({
      fill: makePolygonFillStyle(colors),
      halo: makeLineHaloStyle(colors),
      solid: makeLineStyle(colors),
      dashed: makeLineDashedStyle(colors),
      label: { ...makePolygonLabelStyle(colors, labelSize), visibility: showLabels ? 'visible' : 'none' } as const,
    }),
    [colors, showLabels, labelSize],
  );

  return (
    <>
      <ShapeSource id="polygon-fills" shape={fills}>
        <FillLayer id="polygons-fill" style={styles.fill} filter={visible as unknown as Filter} />
      </ShapeSource>
      <ShapeSource
        id="polygons"
        shape={shapes}
        onPress={(e) => {
          const id = e.features[0]?.properties?.id;
          if (typeof id === 'string') onItemPress?.(id, { lat: e.coordinates.latitude, lon: e.coordinates.longitude }, { kind: 'polygon', sidc: null });
        }}>
        <LineLayer id="polygons-halo" style={styles.halo} filter={all(visible, OUTLINE)} />
        <LineLayer id="polygons-solid" style={styles.solid} filter={all(visible, OUTLINE, ['==', ['get', 'dash'], 'solid'])} />
        <LineLayer id="polygons-dashed" style={styles.dashed} filter={all(visible, OUTLINE, ['==', ['get', 'dash'], 'dashed'])} />
        <SymbolLayer id="polygons-label" style={styles.label} filter={all(visible, ['==', ['get', 'role'], 'label'])} />
      </ShapeSource>
    </>
  );
}
