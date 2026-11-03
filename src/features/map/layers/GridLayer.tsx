import { LineLayer, ShapeSource, SymbolLayer } from '@rnmapbox/maps';
import { useMemo, type ComponentProps } from 'react';

import { useInteraction } from '@/stores/interaction';
import { useSettings } from '@/stores/settings';
import { gridShadeColors } from '@/theme/tokens';

import { eastingsRunSouth, mgrsGrid, orientEastings } from './mgrs-grid';
import { makeGridAreaLabelStyle, makeGridCasingStyle, makeGridLineLabelStyle, makeGridLineStyle } from './styles';

/** The lowest mission item layer: the grid stays under it even when switched on after the items are drawn. */
const BELOW = 'polygons-fill';
type Filter = ComponentProps<typeof SymbolLayer>['filter'];
const EASTINGS = ['==', ['get', 'axis'], 'e'] as unknown as Filter;
const NORTHINGS = ['==', ['get', 'axis'], 'n'] as unknown as Filter;

/**
 * The MGRS grid (the Show MGRS grid setting), for the grid view and half a screen around it. MapCanvas moves the grid
 * view on, even mid-gesture, only when the lines drawn are about to run out; in between, Mapbox moves the lines it has.
 */
export function GridLayer() {
  const show = useSettings((s) => s.showMgrsGrid);
  const showLabels = useSettings((s) => s.showGridLabels);
  const finest = useSettings((s) => (s.showGrid100m ? 100 : 1_000));
  const view = useInteraction((s) => s.gridView);
  // Easting numbers read down the screen; the lines turn around only when the map turns far enough to tip them over.
  const south = useInteraction((s) => eastingsRunSouth(s.cameraBearing));
  const shade = useSettings((s) => s.gridColor);
  const strength = useSettings((s) => s.gridStrength);
  const grid = useMemo(() => (show && view ? mgrsGrid(view, finest) : null), [show, view, finest]);
  const lines = useMemo(() => grid && orientEastings(grid.lines, south), [grid, south]);
  const styles = useMemo(() => {
    const visibility = showLabels ? 'visible' : 'none';
    const colors = gridShadeColors(shade);
    return {
      casing: makeGridCasingStyle(colors, strength),
      line: makeGridLineStyle(colors, strength),
      eastingLabel: { ...makeGridLineLabelStyle(colors, false), visibility } as const,
      northingLabel: { ...makeGridLineLabelStyle(colors), visibility } as const,
      areaLabel: { ...makeGridAreaLabelStyle(colors), visibility } as const,
    };
  }, [shade, strength, showLabels]);
  if (!grid || !lines) return null;

  return (
    <>
      <ShapeSource id="mgrs-grid" shape={lines}>
        {/* Added first, so it lands under the lines (each layer goes in just below BELOW). */}
        <LineLayer id="mgrs-grid-casing" belowLayerID={BELOW} style={styles.casing} />
        <LineLayer id="mgrs-grid-lines" belowLayerID={BELOW} style={styles.line} />
        <SymbolLayer id="mgrs-grid-easting-labels" belowLayerID={BELOW} style={styles.eastingLabel} filter={EASTINGS} />
        <SymbolLayer id="mgrs-grid-northing-labels" belowLayerID={BELOW} style={styles.northingLabel} filter={NORTHINGS} />
      </ShapeSource>
      <ShapeSource id="mgrs-grid-areas" shape={grid.labels}>
        <SymbolLayer id="mgrs-grid-area-labels" belowLayerID={BELOW} style={styles.areaLabel} />
      </ShapeSource>
    </>
  );
}
