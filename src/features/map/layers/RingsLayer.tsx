import { FillLayer, LineLayer, ShapeSource } from '@rnmapbox/maps';
import { useMemo, type ComponentProps } from 'react';

import { createRingFeatureSelector } from '@/features/map-items/ring-selectors';
import { observeHiddenItemIds, observeMissionItems, observeRingItemIds, type MapItemSnapshot } from '@/features/map-items/repository';
import { hiddenFilter } from '@/features/map-items/selectors';
import type { ItemRef } from '@/features/symbology/categories';
import { useObservable } from '@/hooks/use-observable';
import { useCommandContext } from '@/lib/db/command-context-provider';
import type { LatLon } from '@/lib/geo/types';
import { useTheme } from '@/theme/ThemeProvider';

import { makeRingFillStyle, makeRingHaloStyle, makeRingHitStyle, makeRingLineStyle } from './styles';

type Filter = ComponentProps<typeof LineLayer>['filter'];
const NO_ITEMS: MapItemSnapshot[] = [];
const NO_IDS: string[] = [];

type Props = {
  missionId: string;
  /** A tap on a ring's border, as a tap on its unit (no `itemAt`: in a map mode it counts at the tapped spot). */
  onItemPress?: (id: string, at: LatLon, item: ItemRef, itemAt: LatLon | null) => void;
};

/**
 * Range rings of units whose ring is switched on: a light tint with an outline, kept while a unit's details are open.
 * Only the border is tappable (it selects the unit): the inside stays the map, so a tap there still pans, places or clears.
 */
export function RingsLayer({ missionId, onItemPress }: Props) {
  const ctx = useCommandContext();
  const { colors } = useTheme();
  const items = useObservable(() => observeMissionItems(ctx.db, missionId), NO_ITEMS, [ctx, missionId]);
  const hiddenIds = useObservable(() => observeHiddenItemIds(ctx.db), NO_IDS, [ctx]);
  const ringIds = useObservable(() => observeRingItemIds(ctx.db), NO_IDS, [ctx]);
  const select = useMemo(() => createRingFeatureSelector(), []);
  const shape = useMemo(() => select(items), [select, items]);
  // The outlines alone, in a source of their own: tapping it never hits the fill inside.
  const outlines = useMemo(
    () => ({ ...shape, features: shape.features.map((f) => ({ ...f, geometry: { type: 'LineString' as const, coordinates: f.geometry.coordinates[0] } })) }),
    [shape],
  );
  const filter = useMemo(
    () => ['all', ['in', ['get', 'id'], ['literal', ringIds]], hiddenFilter(hiddenIds)] as unknown as Filter,
    [ringIds, hiddenIds],
  );
  const styles = useMemo(
    () => ({ fill: makeRingFillStyle(colors), halo: makeRingHaloStyle(colors), line: makeRingLineStyle(colors), hit: makeRingHitStyle(colors) }),
    [colors],
  );

  return (
    <>
      <ShapeSource id="rings" shape={shape}>
        <FillLayer id="rings-fill" style={styles.fill} filter={filter} />
        <LineLayer id="rings-halo" style={styles.halo} filter={filter} />
        <LineLayer id="rings-line" style={styles.line} filter={filter} />
      </ShapeSource>
      <ShapeSource
        id="rings-hit"
        shape={outlines}
        onPress={(e) => {
          const id = e.features[0]?.properties?.id;
          const item = typeof id === 'string' ? items.find((i) => i.id === id) : undefined;
          if (item) onItemPress?.(item.id, { lat: e.coordinates.latitude, lon: e.coordinates.longitude }, { kind: item.kind, sidc: item.sidc }, null);
        }}>
        <LineLayer id="rings-hit-line" style={styles.hit} filter={filter} />
      </ShapeSource>
    </>
  );
}
