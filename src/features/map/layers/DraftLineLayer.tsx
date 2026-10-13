import { LineLayer, ShapeSource, SymbolLayer } from '@rnmapbox/maps';
import { useMemo, type ComponentProps } from 'react';

import { useDraft } from '@/stores/draft';
import { useSettings } from '@/stores/settings';
import type { LatLon } from '@/lib/geo/types';
import { useTheme } from '@/theme/ThemeProvider';

import { MAP_IMAGE_IDS } from '../images/map-images';
import { draftLineFeatures } from './draft-line-features';
import { LINE_ARROW_STYLE, LINE_FLOT_STYLE, makeLineDashedStyle, makeLineHaloStyle, makeLineLabelStyle, makeLineStyle, makeRangeLabelStyle } from './styles';

type Filter = ComponentProps<typeof SymbolLayer>['filter'];
const role = (r: string, extra?: unknown[]) => (extra ? ['all', ['==', ['get', 'role'], r], extra] : ['==', ['get', 'role'], r]) as unknown as Filter;

const VERTEX_STYLE = {
  iconImage: MAP_IMAGE_IDS.lineVertex,
  iconAllowOverlap: true,
  iconIgnorePlacement: true,
  textField: ['get', 'number'],
  textSize: 11,
  textAllowOverlap: true,
  textIgnorePlacement: true,
} as const;
const SELECTED_STYLE = { iconImage: MAP_IMAGE_IDS.draftRing, iconAllowOverlap: true, iconIgnorePlacement: true } as const;

/** The line being added or edited (also while viewing a saved line read-only). */
/** `onPress` gets taps on the draft that miss a vertex marker (the line, a chip): they count as map taps. */
export function DraftLineLayer({ onVertexPress, onPress }: { onVertexPress?: (index: number) => void; onPress?: (at: LatLon) => void }) {
  const { colors } = useTheme();
  const vertices = useDraft((s) => s.vertices);
  const selected = useDraft((s) => s.selectedVertex);
  const lineType = useDraft((s) => s.lineType);
  const name = useDraft((s) => s.name);
  const showDistances = useSettings((s) => s.showLineDistances);
  const shape = useMemo(
    () => draftLineFeatures({ vertices, selected, lineType, name, showDistances }),
    [vertices, selected, lineType, name, showDistances],
  );
  const styles = useMemo(
    () => ({
      halo: makeLineHaloStyle(colors),
      solid: makeLineStyle(colors),
      dashed: makeLineDashedStyle(colors),
      segment: makeRangeLabelStyle(colors),
      label: makeLineLabelStyle(colors),
      vertex: { ...VERTEX_STYLE, textColor: colors['surface-input'] },
    }),
    [colors],
  );

  return (
    <ShapeSource
      id="draft-line"
      shape={shape}
      onPress={(e) => {
        // A tap can hit several features (the end vertex sits under the name chip): prefer a vertex.
        const index = e.features.find((f) => f.properties?.role === 'vertex')?.properties?.index;
        if (typeof index === 'number') onVertexPress?.(index);
        else onPress?.({ lat: e.coordinates.latitude, lon: e.coordinates.longitude });
      }}>
      <LineLayer id="draft-line-halo" style={styles.halo} filter={role('line') as never} />
      <LineLayer id="draft-line-solid" style={styles.solid} filter={role('line', ['==', ['get', 'dash'], 'solid']) as never} />
      <LineLayer id="draft-line-dashed" style={styles.dashed} filter={role('line', ['==', ['get', 'dash'], 'dashed']) as never} />
      <SymbolLayer id="draft-line-flot" style={LINE_FLOT_STYLE} filter={role('line', ['==', ['get', 'decoration'], 'flot-arcs'])} />
      <SymbolLayer id="draft-line-arrow" style={LINE_ARROW_STYLE} filter={role('end')} />
      <SymbolLayer id="draft-line-segment" style={styles.segment} filter={role('segment')} />
      <SymbolLayer id="draft-line-selected" style={SELECTED_STYLE} filter={role('vertex', ['==', ['get', 'selected'], true])} />
      <SymbolLayer id="draft-line-vertex" style={styles.vertex} filter={role('vertex')} />
      <SymbolLayer id="draft-line-label" style={styles.label} filter={role('label')} />
    </ShapeSource>
  );
}
