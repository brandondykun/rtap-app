import { LineLayer, ShapeSource, SymbolLayer } from '@rnmapbox/maps';
import { useMemo, type ComponentProps } from 'react';

import { draftSidc } from '@/features/map-items/draft-sidc';
import { describeVector } from '@/lib/geo/vector';
import { useDraft } from '@/stores/draft';
import { useSettings } from '@/stores/settings';
import { useTheme } from '@/theme/ThemeProvider';

import { useReadoutOrigin } from '../interaction/use-readout-origin';
import { draftFeatureCollection } from './draft-features';
import {
  DRAFT_FILTERS,
  DRAFT_RING_STYLE,
  DRAFT_SYMBOL_STYLE,
  makeDraftLabelStyle,
  makeRangeLabelStyle,
  makeRangeLineStyle,
} from './styles';
import { useLabelTextSize } from './use-label-text-size';

type Filter = ComponentProps<typeof SymbolLayer>['filter'];
const filter = (f: unknown) => f as Filter;

/** The in-progress point: symbol, dashed ring, NEW/EDIT chip, and range line from the user (from the OP in OP mode). */
export function DraftLayer() {
  const { colors } = useTheme();
  const mode = useDraft((s) => s.mode);
  const coord = useDraft((s) => s.coord);
  const affiliation = useDraft((s) => s.affiliation);
  const unitType = useDraft((s) => s.unitType);
  const echelon = useDraft((s) => s.echelon);
  const category = useDraft((s) => s.category);
  const pointType = useDraft((s) => s.pointType);
  const name = useDraft((s) => s.name);
  const locked = useDraft((s) => s.locked);
  // Measured from the same place as the CTR readout: the OP while standing at one.
  const self = useReadoutOrigin().from;
  const angleUnit = useSettings((s) => s.angleUnit);
  const northRef = useSettings((s) => s.northRef);
  const declinationOverrideDeg = useSettings((s) => s.declinationOverrideDeg);

  const labelSize = useLabelTextSize();
  const labelStyle = useMemo(() => makeDraftLabelStyle(colors, labelSize), [colors, labelSize]);
  const lineStyle = useMemo(() => makeRangeLineStyle(colors), [colors]);
  const rangeLabelStyle = useMemo(() => makeRangeLabelStyle(colors), [colors]);

  const shape = useMemo(() => {
    if (!mode || !coord || category === 'line' || category === 'polygon') return draftFeatureCollection(null);
    const v = self ? describeVector(self, coord, { date: new Date(), declinationOverrideDeg, unit: angleUnit, ref: northRef }) : null;
    return draftFeatureCollection({
      coord,
      sidc: draftSidc({ category, affiliation, unitType, echelon, pointType }),
      // A selected (view-only) point shows just its name; drafts being placed or edited are tagged.
      label: locked ? name.trim() || '…' : `${name.trim() || '…'} · ${mode === 'add' ? 'NEW' : 'EDIT'}`,
      self,
      rangeLabel: v ? `${v.distanceLabel} · ${v.bearingLabel}` : null,
    });
  }, [mode, coord, category, affiliation, unitType, echelon, pointType, name, locked, self, angleUnit, northRef, declinationOverrideDeg]);

  return (
    <ShapeSource id="draft" shape={shape}>
      <LineLayer id="draft-range-line" style={lineStyle} filter={filter(DRAFT_FILTERS.range)} />
      <SymbolLayer id="draft-range-label" style={rangeLabelStyle} filter={filter(DRAFT_FILTERS.rangeLabel)} />
      <SymbolLayer id="draft-ring" style={DRAFT_RING_STYLE} filter={filter(DRAFT_FILTERS.draft)} />
      <SymbolLayer id="draft-symbol" style={DRAFT_SYMBOL_STYLE} filter={filter(DRAFT_FILTERS.draft)} />
      <SymbolLayer id="draft-label" style={labelStyle} filter={filter(DRAFT_FILTERS.draft)} />
    </ShapeSource>
  );
}
