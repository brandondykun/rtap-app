import { LineLayer, ShapeSource, SymbolLayer } from '@rnmapbox/maps';
import { useMemo, type ComponentProps } from 'react';

import { useInteraction } from '@/stores/interaction';
import { useSettings } from '@/stores/settings';
import { useTheme } from '@/theme/ThemeProvider';

import { eastingsRunSouth, mgrsGrid, orientEastings } from './mgrs-grid';
import { makeGridAreaLabelStyle, makeGridLineLabelStyle, makeGridLineStyle } from './styles';

/** The lowest mission item layer: the grid stays under it even when switched on after the items are drawn. */
const BELOW = 'polygons-fill';
type Filter = ComponentProps<typeof SymbolLayer>['filter'];
const EASTINGS = ['==', ['get', 'axis'], 'e'] as unknown as Filter;
const NORTHINGS = ['==', ['get', 'axis'], 'n'] as unknown as Filter;

/**
 * The MGRS grid (the Show MGRS grid setting). Worked out only when the map comes to rest, for the view and half a
 * screen around it; while the map moves, Mapbox moves the lines it already has.
 */
export function GridLayer() {
  const show = useSettings((s) => s.showMgrsGrid);
  const showLabels = useSettings((s) => s.showGridLabels);
  const view = useInteraction((s) => s.restingView);
  // Easting numbers read down the screen; the lines turn around only when the map turns far enough to tip them over.
  const south = useInteraction((s) => eastingsRunSouth(s.cameraBearing));
  const { colors } = useTheme();
  const grid = useMemo(() => (show && view ? mgrsGrid(view) : null), [show, view]);
  const lines = useMemo(() => grid && orientEastings(grid.lines, south), [grid, south]);
  const styles = useMemo(() => {
    const visibility = showLabels ? 'visible' : 'none';
    return {
      line: makeGridLineStyle(colors),
      eastingLabel: { ...makeGridLineLabelStyle(colors, false), visibility } as const,
      northingLabel: { ...makeGridLineLabelStyle(colors), visibility } as const,
      areaLabel: { ...makeGridAreaLabelStyle(colors), visibility } as const,
    };
  }, [colors, showLabels]);
  if (!grid || !lines) return null;

  return (
    <>
      <ShapeSource id="mgrs-grid" shape={lines}>
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
