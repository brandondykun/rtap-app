import { LineLayer, ShapeSource, SymbolLayer } from '@rnmapbox/maps';
import { useMemo } from 'react';

import { useInteraction } from '@/stores/interaction';
import { useSettings } from '@/stores/settings';
import { useTheme } from '@/theme/ThemeProvider';

import { mgrsGrid } from './mgrs-grid';
import { makeGridAreaLabelStyle, makeGridLineLabelStyle, makeGridLineStyle } from './styles';

/** The lowest mission item layer: the grid stays under it even when switched on after the items are drawn. */
const BELOW = 'polygons-fill';

/**
 * The MGRS grid (the Show MGRS grid setting). Worked out only when the map comes to rest, for the view and half a
 * screen around it; while the map moves, Mapbox moves the lines it already has.
 */
export function GridLayer() {
  const show = useSettings((s) => s.showMgrsGrid);
  const showLabels = useSettings((s) => s.showGridLabels);
  const view = useInteraction((s) => s.restingView);
  const { colors } = useTheme();
  const grid = useMemo(() => (show && view ? mgrsGrid(view) : null), [show, view]);
  const styles = useMemo(() => {
    const visibility = showLabels ? 'visible' : 'none';
    return {
      line: makeGridLineStyle(colors),
      lineLabel: { ...makeGridLineLabelStyle(colors), visibility } as const,
      areaLabel: { ...makeGridAreaLabelStyle(colors), visibility } as const,
    };
  }, [colors, showLabels]);
  if (!grid) return null;

  return (
    <>
      <ShapeSource id="mgrs-grid" shape={grid.lines}>
        <LineLayer id="mgrs-grid-lines" belowLayerID={BELOW} style={styles.line} />
        <SymbolLayer id="mgrs-grid-line-labels" belowLayerID={BELOW} style={styles.lineLabel} filter={['has', 'label']} />
      </ShapeSource>
      <ShapeSource id="mgrs-grid-areas" shape={grid.labels}>
        <SymbolLayer id="mgrs-grid-area-labels" belowLayerID={BELOW} style={styles.areaLabel} />
      </ShapeSource>
    </>
  );
}
