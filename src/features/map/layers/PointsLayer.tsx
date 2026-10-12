import { ShapeSource, SymbolLayer } from '@rnmapbox/maps';
import { useMemo, type ComponentProps } from 'react';

import { observeHiddenItemIds, observeMissionItems, type MapItemSnapshot } from '@/features/map-items/repository';
import { createPointFeatureSelector, hiddenFilter } from '@/features/map-items/selectors';
import { useObservable } from '@/hooks/use-observable';
import { useCommandContext } from '@/lib/db/command-context-provider';
import { useTheme } from '@/theme/ThemeProvider';

import { makePointLabelStyle, POINT_SYMBOL_STYLE } from './styles';

type LayerFilter = ComponentProps<typeof SymbolLayer>['filter'];

const NO_ITEMS: MapItemSnapshot[] = [];
const NO_IDS: string[] = [];

/** All mission points in one ShapeSource; hidden items are filtered out, never removed. */
export function PointsLayer({ missionId }: { missionId: string }) {
  const ctx = useCommandContext();
  const { colors } = useTheme();
  const items = useObservable(() => observeMissionItems(ctx.db, missionId), NO_ITEMS, [ctx, missionId]);
  const hiddenIds = useObservable(() => observeHiddenItemIds(ctx.db), NO_IDS, [ctx]);
  const select = useMemo(() => createPointFeatureSelector(), []);
  const shape = useMemo(() => select(items), [select, items]);
  const filter = useMemo(() => hiddenFilter(hiddenIds) as unknown as LayerFilter, [hiddenIds]);
  const labelStyle = useMemo(() => makePointLabelStyle(colors), [colors]);

  return (
    <ShapeSource id="points" shape={shape}>
      <SymbolLayer id="points-symbols" style={POINT_SYMBOL_STYLE} filter={filter} />
      <SymbolLayer id="points-labels" style={labelStyle} filter={filter} />
    </ShapeSource>
  );
}
