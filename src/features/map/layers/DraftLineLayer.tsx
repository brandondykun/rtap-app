import { LineLayer, ShapeSource, SymbolLayer } from '@rnmapbox/maps';
import { useMemo, type ComponentProps } from 'react';

import { useDraft } from '@/stores/draft';
import { useTheme } from '@/theme/ThemeProvider';

import { MAP_IMAGE_IDS } from '../images/map-images';
import { draftLineFeatures } from './draft-line-features';
import { makeLineDashedStyle, makeLineHaloStyle, makeLineLabelStyle, makeLineStyle, makeRangeLabelStyle } from './styles';

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
export function DraftLineLayer({ onVertexPress }: { onVertexPress?: (index: number) => void }) {
  const { colors } = useTheme();
  const vertices = useDraft((s) => s.vertices);
  const selected = useDraft((s) => s.selectedVertex);
  const lineType = useDraft((s) => s.lineType);
  const name = useDraft((s) => s.name);
  const shape = useMemo(() => draftLineFeatures({ vertices, selected, lineType, name }), [vertices, selected, lineType, name]);
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
        const props = e.features[0]?.properties;
        if (props?.role === 'vertex' && typeof props.index === 'number') onVertexPress?.(props.index);
      }}>
      <LineLayer id="draft-line-halo" style={styles.halo} filter={role('line') as never} />
      <LineLayer id="draft-line-solid" style={styles.solid} filter={role('line', ['==', ['get', 'dash'], 'solid']) as never} />
      <LineLayer id="draft-line-dashed" style={styles.dashed} filter={role('line', ['==', ['get', 'dash'], 'dashed']) as never} />
      <SymbolLayer id="draft-line-segment" style={styles.segment} filter={role('segment')} />
      <SymbolLayer id="draft-line-selected" style={SELECTED_STYLE} filter={role('vertex', ['==', ['get', 'selected'], true])} />
      <SymbolLayer id="draft-line-vertex" style={styles.vertex} filter={role('vertex')} />
      <SymbolLayer id="draft-line-label" style={styles.label} filter={role('label')} />
    </ShapeSource>
  );
}
