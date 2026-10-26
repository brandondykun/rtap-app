import { FillLayer, LineLayer, ShapeSource, SymbolLayer } from '@rnmapbox/maps';
import { useMemo, type ComponentProps } from 'react';

import type { LatLon } from '@/lib/geo/types';
import { useDraft } from '@/stores/draft';
import { useSettings } from '@/stores/settings';
import { useTheme } from '@/theme/ThemeProvider';

import { MAP_IMAGE_IDS } from '../images/map-images';
import { draftPolygonFeatures } from './draft-polygon-features';
import {
  makeLineHaloStyle,
  makePolygonFillStyle,
  makePolygonLabelStyle,
  makePolygonOutlineDashedStyle,
  makePolygonOutlineStyle,
  makeRangeLabelStyle,
} from './styles';
import { useLabelTextSize } from './use-label-text-size';

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
const CENTER_STYLE = { iconImage: MAP_IMAGE_IDS.lineVertex, iconAllowOverlap: true, iconIgnorePlacement: true } as const;
const SELECTED_STYLE = { iconImage: MAP_IMAGE_IDS.draftRing, iconAllowOverlap: true, iconIgnorePlacement: true } as const;

/** The polygon being added or edited (also while viewing a saved one). Taps that miss a vertex count as map taps. */
export function DraftPolygonLayer({ onVertexPress, onPress }: { onVertexPress?: (index: number) => void; onPress?: (at: LatLon) => void }) {
  const { colors } = useTheme();
  const polygonShape = useDraft((s) => s.polygonShape);
  const vertices = useDraft((s) => s.vertices);
  const selected = useDraft((s) => s.selectedVertex);
  const center = useDraft((s) => s.coord);
  const radiusM = useDraft((s) => s.circleRadiusM);
  const polygonType = useDraft((s) => s.polygonType);
  const fill = useDraft((s) => s.polygonFill);
  const name = useDraft((s) => s.name);
  const showDistances = useSettings((s) => s.showLineDistances);
  const labelSize = useLabelTextSize();
  // The fill gets its own untappable source: a touchable fill would swallow taps on items inside an open polygon.
  const { fills, shape } = useMemo(() => {
    const all = draftPolygonFeatures({ polygonShape, vertices, selected, center, radiusM, polygonType, fill, name, showDistances });
    return {
      fills: { type: 'FeatureCollection' as const, features: all.features.filter((f) => f.properties.role === 'fill') },
      shape: { type: 'FeatureCollection' as const, features: all.features.filter((f) => f.properties.role !== 'fill') },
    };
  }, [polygonShape, vertices, selected, center, radiusM, polygonType, fill, name, showDistances]);
  const styles = useMemo(
    () => ({
      fill: makePolygonFillStyle(colors),
      halo: makeLineHaloStyle(colors),
      solid: makePolygonOutlineStyle(colors),
      dashed: makePolygonOutlineDashedStyle(colors),
      chip: makeRangeLabelStyle(colors),
      label: makePolygonLabelStyle(colors, labelSize),
      vertex: { ...VERTEX_STYLE, textColor: colors['surface-input'] },
    }),
    [colors, labelSize],
  );

  return (
    <>
      <ShapeSource id="draft-polygon-fills" shape={fills}>
        <FillLayer id="draft-polygon-fill" style={styles.fill} />
      </ShapeSource>
      <ShapeSource
        id="draft-polygon"
        shape={shape}
        onPress={(e) => {
          const index = e.features.find((f) => f.properties?.role === 'vertex')?.properties?.index;
          if (typeof index === 'number') onVertexPress?.(index);
          else onPress?.({ lat: e.coordinates.latitude, lon: e.coordinates.longitude });
        }}>
        <LineLayer id="draft-polygon-halo" style={styles.halo} filter={role('outline') as never} />
        <LineLayer id="draft-polygon-solid" style={styles.solid} filter={role('outline', ['==', ['get', 'dash'], 'solid']) as never} />
        <LineLayer id="draft-polygon-dashed" style={styles.dashed} filter={role('outline', ['==', ['get', 'dash'], 'dashed']) as never} />
        <SymbolLayer id="draft-polygon-segment" style={styles.chip} filter={role('segment')} />
        <SymbolLayer id="draft-polygon-radius" style={styles.chip} filter={role('radius')} />
        <SymbolLayer id="draft-polygon-selected" style={SELECTED_STYLE} filter={role('vertex', ['==', ['get', 'selected'], true])} />
        <SymbolLayer id="draft-polygon-vertex" style={styles.vertex} filter={role('vertex')} />
        <SymbolLayer id="draft-polygon-center" style={CENTER_STYLE} filter={role('center')} />
        <SymbolLayer id="draft-polygon-label" style={styles.label} filter={role('label')} />
      </ShapeSource>
    </>
  );
}
