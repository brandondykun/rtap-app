import { CircleLayer, LineLayer, ShapeSource, SymbolLayer } from '@rnmapbox/maps';
import { useMemo, type ComponentProps } from 'react';

import { measureFeatures } from '@/features/measure/measure-features';
import { measureParts, measureReadout } from '@/features/measure/measure-readout';
import type { MeasurePoint } from '@/features/measure/measure-step';
import { useMeasure } from '@/stores/measure';
import { useSettings } from '@/stores/settings';
import { useTheme } from '@/theme/ThemeProvider';

import { MAP_IMAGE_IDS } from '../images/map-images';
import { useOpSymbolStyle } from './op-symbol-scale';
import { makeLineHaloStyle, makeMeasureChipStyle, makeMeasurePickedStyle } from './styles';

type Filter = ComponentProps<typeof LineLayer>['filter'];
const LINE = ['==', ['get', 'role'], 'line'] as unknown as Filter;
const CHIP = ['==', ['get', 'role'], 'chip'] as unknown as Filter;
const PICKED = ['==', ['get', 'picked'], true] as unknown as Filter;
// Full size, like the line tool's vertices, so the point's number fits on it.
const DOT_STYLE = { iconImage: MAP_IMAGE_IDS.lineVertex, iconAllowOverlap: true, iconIgnorePlacement: true } as const;
/** Each dot's number (1 start, 2 end), so the direction of the bearing is clear. Its own layer: OP mode sizes icons and text apart. */
const NUMBER_STYLE = { textField: ['get', 'number'], textSize: 11, textAllowOverlap: true, textIgnorePlacement: true } as const;
/** A finger-sized target around each dot (points), so picking one is easy. */
export const MEASURE_DOT_HITBOX = { width: 44, height: 44 };

/**
 * The measure line from start to end (only the start dot until the end is set), its readout chip at the middle, and the
 * dots numbered 1 (start) and 2 (end), which a tap picks to move (ringed while picked). The dots have a source of their own, so only they take taps:
 * a tap anywhere else, even on the line, still sets the point being set.
 */
export function MeasureLayer() {
  const { colors } = useTheme();
  const iconStyle = useOpSymbolStyle(DOT_STYLE);
  const start = useMeasure((s) => s.start);
  const end = useMeasure((s) => s.end);
  const editing = useMeasure((s) => s.editing);
  const angleUnit = useSettings((s) => s.angleUnit);
  const northRef = useSettings((s) => s.northRef);
  const declinationOverrideDeg = useSettings((s) => s.declinationOverrideDeg);
  const { shape, dots } = useMemo(() => {
    const s = { angleUnit, northRef, declinationOverrideDeg };
    const label = start && end ? measureReadout(start, end, s) : '';
    const all = measureFeatures(start, end, label, start && end ? measureParts(start, end, s) : undefined, editing);
    return {
      shape: { ...all, features: all.features.filter((f) => f.properties.role !== 'dot') },
      dots: { ...all, features: all.features.filter((f) => f.properties.role === 'dot') },
    };
  }, [start, end, editing, angleUnit, northRef, declinationOverrideDeg]);
  const styles = useMemo(() => {
    // Measure is drawn in amber over the same dark halo as lines (halo uses the normal 3 pt width).
    const line = { lineColor: colors.accent, lineWidth: 3, lineCap: 'round' as const, lineJoin: 'round' as const };
    return {
      halo: makeLineHaloStyle(colors),
      line,
      chip: makeMeasureChipStyle(colors),
      picked: makeMeasurePickedStyle(colors),
      number: { ...NUMBER_STYLE, textColor: colors['surface-input'] },
    };
  }, [colors]);
  const chipStyle = useOpSymbolStyle(styles.chip);
  const numberStyle = useOpSymbolStyle(styles.number);

  return (
    <>
      <ShapeSource id="measure" shape={shape}>
        <LineLayer id="measure-halo" style={styles.halo} filter={LINE} />
        <LineLayer id="measure-line" style={styles.line} filter={LINE} />
        <SymbolLayer id="measure-chip" style={chipStyle} filter={CHIP} />
      </ShapeSource>
      <ShapeSource
        id="measure-points"
        shape={dots}
        hitbox={MEASURE_DOT_HITBOX}
        onPress={(e) => {
          const point = e.features[0]?.properties?.point as MeasurePoint | undefined;
          if (point === 'start' || point === 'end') useMeasure.getState().pick(point);
        }}>
        <CircleLayer id="measure-picked" style={styles.picked} filter={PICKED} />
        <SymbolLayer id="measure-dots" style={iconStyle} />
        <SymbolLayer id="measure-numbers" style={numberStyle} />
      </ShapeSource>
    </>
  );
}
