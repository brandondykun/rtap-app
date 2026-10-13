import { LineLayer, ShapeSource, SymbolLayer } from '@rnmapbox/maps';
import { useMemo, type ComponentProps } from 'react';

import { measureFeatures } from '@/features/measure/measure-features';
import { measureReadout } from '@/features/measure/measure-readout';
import { useInteraction } from '@/stores/interaction';
import { useMeasure } from '@/stores/measure';
import { useSettings } from '@/stores/settings';
import { useTheme } from '@/theme/ThemeProvider';

import { MAP_IMAGE_IDS } from '../images/map-images';
import { LINE_DASH, makeLineHaloStyle, makeMeasureChipStyle } from './styles';

type Filter = ComponentProps<typeof LineLayer>['filter'];
const LINE = ['==', ['get', 'role'], 'line'] as unknown as Filter;
const LIVE = ['all', ['==', ['get', 'role'], 'line'], ['==', ['get', 'live'], true]] as unknown as Filter;
const FIXED = ['all', ['==', ['get', 'role'], 'line'], ['==', ['get', 'live'], false]] as unknown as Filter;
const DOTS = ['==', ['get', 'role'], 'dot'] as unknown as Filter;
const CHIP = ['==', ['get', 'role'], 'chip'] as unknown as Filter;
const DOT_STYLE = { iconImage: MAP_IMAGE_IDS.lineVertex, iconSize: 0.7, iconAllowOverlap: true, iconIgnorePlacement: true } as const;

/** The measure line from start to end (or to the crosshair while the end is live). */
export function MeasureLayer() {
  const { colors } = useTheme();
  const start = useMeasure((s) => s.start);
  const fixedEnd = useMeasure((s) => s.end);
  const center = useInteraction((s) => s.cameraCenter);
  const angleUnit = useSettings((s) => s.angleUnit);
  const northRef = useSettings((s) => s.northRef);
  const declinationOverrideDeg = useSettings((s) => s.declinationOverrideDeg);
  const end = fixedEnd ?? center;
  const shape = useMemo(() => {
    const label = start && end ? measureReadout(start, end, { angleUnit, northRef, declinationOverrideDeg }) : '';
    return measureFeatures(start, end, label, fixedEnd === null);
  }, [start, end, fixedEnd, angleUnit, northRef, declinationOverrideDeg]);
  const styles = useMemo(() => {
    // Measure is drawn in amber over the same dark halo as lines (halo uses the normal 3 pt width).
    const line = { lineColor: colors.accent, lineWidth: 3, lineCap: 'round' as const, lineJoin: 'round' as const };
    return { halo: makeLineHaloStyle(colors), solid: line, dashed: { ...line, lineCap: 'butt' as const, lineDasharray: LINE_DASH }, chip: makeMeasureChipStyle(colors) };
  }, [colors]);

  return (
    <ShapeSource id="measure" shape={shape}>
      <LineLayer id="measure-halo" style={styles.halo} filter={LINE} />
      <LineLayer id="measure-solid" style={styles.solid} filter={FIXED} />
      <LineLayer id="measure-dashed" style={styles.dashed} filter={LIVE} />
      <SymbolLayer id="measure-dots" style={DOT_STYLE} filter={DOTS} />
      <SymbolLayer id="measure-chip" style={styles.chip} filter={CHIP} />
    </ShapeSource>
  );
}
