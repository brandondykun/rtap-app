import { LineLayer, ShapeSource, SymbolLayer } from '@rnmapbox/maps';
import { useMemo, type ComponentProps } from 'react';

import { createLineFeatureSelector } from '@/features/map-items/line-selectors';
import { observeHiddenItemIds, observeMissionItems, type MapItemSnapshot } from '@/features/map-items/repository';
import { hiddenFilter } from '@/features/map-items/selectors';
import type { ItemRef } from '@/features/symbology/categories';
import { useObservable } from '@/hooks/use-observable';
import { useCommandContext } from '@/lib/db/command-context-provider';
import type { LatLon } from '@/lib/geo/types';
import { useInteraction } from '@/stores/interaction';
import { useSettings } from '@/stores/settings';
import { useTheme } from '@/theme/ThemeProvider';

import { useOpSymbolStyle } from './op-symbol-scale';
import { LINE_ARROW_STYLE, LINE_FLOT_STYLE, makeLineDashedStyle, makeLineHaloStyle, makeLineLabelStyle, makeLineStyle } from './styles';
import { useLabelTextSize } from './use-label-text-size';

type Filter = ComponentProps<typeof LineLayer>['filter'];
const NO_ITEMS: MapItemSnapshot[] = [];
const NO_IDS: string[] = [];
const all = (...parts: unknown[]) => ['all', ...parts] as unknown as Filter;

/** Degrees the map turns before end labels re-check which way is up. */
const LABEL_BEARING_STEP = 15;

type Props = { missionId: string; excludeId?: string | null; onItemPress?: (id: string, at: LatLon, item: ItemRef) => void };

/** Saved lines: halo + line (solid or dashed), end arrows, FLOT bumps and end labels. */
export function LinesLayer({ missionId, excludeId = null, onItemPress }: Props) {
  const ctx = useCommandContext();
  const { colors } = useTheme();
  const showLabels = useSettings((s) => s.showMapLabels);
  const labelSize = useLabelTextSize();
  // End labels flip to stay upright as the map turns; a coarse bearing restyles them only now and then.
  const mapBearing = useInteraction((s) => (Math.round(s.cameraBearing / LABEL_BEARING_STEP) * LABEL_BEARING_STEP) % 360);
  const items = useObservable(() => observeMissionItems(ctx.db, missionId), NO_ITEMS, [ctx, missionId]);
  const hiddenIds = useObservable(() => observeHiddenItemIds(ctx.db), NO_IDS, [ctx]);
  const select = useMemo(() => createLineFeatureSelector(), []);
  const { lines, ends } = useMemo(() => select(items), [select, items]);
  const visible = useMemo(() => hiddenFilter(excludeId ? [...hiddenIds, excludeId] : hiddenIds), [hiddenIds, excludeId]);
  const styles = useMemo(
    () => ({
      halo: makeLineHaloStyle(colors),
      solid: makeLineStyle(colors),
      dashed: makeLineDashedStyle(colors),
      label: { ...makeLineLabelStyle(colors, labelSize, mapBearing), visibility: showLabels ? 'visible' : 'none' } as const,
    }),
    [colors, showLabels, labelSize, mapBearing],
  );
  const labelStyle = useOpSymbolStyle(styles.label);

  return (
    <>
      <ShapeSource
        id="lines"
        shape={lines}
        onPress={(e) => {
          const id = e.features[0]?.properties?.id;
          if (typeof id === 'string') onItemPress?.(id, { lat: e.coordinates.latitude, lon: e.coordinates.longitude }, { kind: 'line', sidc: null });
        }}>
        <LineLayer id="lines-halo" style={styles.halo} filter={visible as unknown as Filter} />
        <LineLayer id="lines-solid" style={styles.solid} filter={all(visible, ['==', ['get', 'dash'], 'solid'])} />
        <LineLayer id="lines-dashed" style={styles.dashed} filter={all(visible, ['==', ['get', 'dash'], 'dashed'])} />
        <SymbolLayer id="lines-flot" style={LINE_FLOT_STYLE} filter={all(visible, ['==', ['get', 'decoration'], 'flot-arcs'])} />
      </ShapeSource>
      <ShapeSource id="line-ends" shape={ends}>
        <SymbolLayer id="lines-arrow" style={LINE_ARROW_STYLE} filter={all(visible, ['==', ['get', 'end'], 'end'], ['==', ['get', 'endArrow'], true])} />
        <SymbolLayer id="lines-label" style={labelStyle} filter={visible as unknown as Filter} />
      </ShapeSource>
    </>
  );
}
