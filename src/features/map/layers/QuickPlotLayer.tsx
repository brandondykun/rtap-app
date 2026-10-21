import { LineLayer, ShapeSource, SymbolLayer } from '@rnmapbox/maps';
import { useMemo, type ComponentProps } from 'react';

import { quickPlotFeatures } from '@/features/quick-plot/quick-plot-features';
import { describeVector } from '@/lib/geo/vector';
import { useQuickPlot } from '@/stores/quick-plot';
import { useSettings } from '@/stores/settings';
import { useTheme } from '@/theme/ThemeProvider';

import { MAP_IMAGE_IDS } from '../images/map-images';
import { useReadoutOrigin } from '../interaction/use-readout-origin';
import { useOpSymbolStyle } from './op-symbol-scale';
import { makeDraftLabelStyle, makeRangeLabelStyle, makeRangeLineStyle } from './styles';
import { useLabelTextSize } from './use-label-text-size';

type Filter = ComponentProps<typeof SymbolLayer>['filter'];
const role = (r: string) => ['==', ['get', 'role'], r] as unknown as Filter;
const RETICLE_STYLE = { iconImage: MAP_IMAGE_IDS.tempReticle, iconAllowOverlap: true, iconIgnorePlacement: true } as const;

/** The quick plot temporary point: amber reticle, TEMP chip, and the range line from me (from the OP in OP mode). Not tappable. */
export function QuickPlotLayer() {
  const { colors } = useTheme();
  const iconStyle = useOpSymbolStyle(RETICLE_STYLE);
  const temp = useQuickPlot((s) => s.temp);
  // Measured from the same place as the CTR readout: the OP while standing at one.
  const self = useReadoutOrigin().from;
  const angleUnit = useSettings((s) => s.angleUnit);
  const northRef = useSettings((s) => s.northRef);
  const declinationOverrideDeg = useSettings((s) => s.declinationOverrideDeg);
  const shape = useMemo(() => {
    if (!temp) return { type: 'FeatureCollection' as const, features: [] };
    const v = self ? describeVector(self, temp, { date: new Date(), declinationOverrideDeg, unit: angleUnit, ref: northRef }) : null;
    return quickPlotFeatures(temp, self, v ? `${v.distanceLabel} · ${v.bearingLabel}` : null);
  }, [temp, self, angleUnit, northRef, declinationOverrideDeg]);
  const labelSize = useLabelTextSize();
  const styles = useMemo(
    () => ({ line: makeRangeLineStyle(colors), range: makeRangeLabelStyle(colors), label: makeDraftLabelStyle(colors, labelSize) }),
    [colors, labelSize],
  );
  const rangeStyle = useOpSymbolStyle(styles.range);
  const labelStyle = useOpSymbolStyle(styles.label);

  return (
    <ShapeSource id="quick-plot" shape={shape}>
      <LineLayer id="quick-plot-range" style={styles.line} filter={role('range') as never} />
      <SymbolLayer id="quick-plot-range-label" style={rangeStyle} filter={role('range-label')} />
      <SymbolLayer id="quick-plot-reticle" style={iconStyle} filter={role('temp')} />
      <SymbolLayer id="quick-plot-label" style={labelStyle} filter={role('temp')} />
    </ShapeSource>
  );
}
