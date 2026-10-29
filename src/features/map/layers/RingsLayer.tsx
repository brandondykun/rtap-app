import { FillLayer, LineLayer, ShapeSource } from '@rnmapbox/maps';
import { useMemo, type ComponentProps } from 'react';

import { createRingFeatureSelector } from '@/features/map-items/ring-selectors';
import { observeHiddenItemIds, observeMissionItems, observeRingItemIds, type MapItemSnapshot } from '@/features/map-items/repository';
import { hiddenFilter } from '@/features/map-items/selectors';
import { useObservable } from '@/hooks/use-observable';
import { useCommandContext } from '@/lib/db/command-context-provider';
import { useTheme } from '@/theme/ThemeProvider';

import { makeRingFillStyle, makeRingHaloStyle, makeRingLineStyle } from './styles';

type Filter = ComponentProps<typeof LineLayer>['filter'];
const NO_ITEMS: MapItemSnapshot[] = [];
const NO_IDS: string[] = [];

/** Range rings of units whose ring is switched on: a light tint with an outline. Not tappable, and kept while a unit's details are open. */
export function RingsLayer({ missionId }: { missionId: string }) {
  const ctx = useCommandContext();
  const { colors } = useTheme();
  const items = useObservable(() => observeMissionItems(ctx.db, missionId), NO_ITEMS, [ctx, missionId]);
  const hiddenIds = useObservable(() => observeHiddenItemIds(ctx.db), NO_IDS, [ctx]);
  const ringIds = useObservable(() => observeRingItemIds(ctx.db), NO_IDS, [ctx]);
  const select = useMemo(() => createRingFeatureSelector(), []);
  const shape = useMemo(() => select(items), [select, items]);
  const filter = useMemo(
    () => ['all', ['in', ['get', 'id'], ['literal', ringIds]], hiddenFilter(hiddenIds)] as unknown as Filter,
    [ringIds, hiddenIds],
  );
  const styles = useMemo(
    () => ({ fill: makeRingFillStyle(colors), halo: makeRingHaloStyle(colors), line: makeRingLineStyle(colors) }),
    [colors],
  );

  return (
    <ShapeSource id="rings" shape={shape}>
      <FillLayer id="rings-fill" style={styles.fill} filter={filter} />
      <LineLayer id="rings-halo" style={styles.halo} filter={filter} />
      <LineLayer id="rings-line" style={styles.line} filter={filter} />
    </ShapeSource>
  );
}
