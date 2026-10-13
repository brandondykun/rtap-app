import { LineLayer, ShapeSource, SymbolLayer } from '@rnmapbox/maps';
import { useMemo, type ComponentProps } from 'react';

import { draftSidc } from '@/features/map-items/draft-sidc';
import { describeVector } from '@/lib/geo/vector';
import { useDraft } from '@/stores/draft';
import { usePresence } from '@/stores/presence';
import { useSettings } from '@/stores/settings';
import { useTheme } from '@/theme/ThemeProvider';

import { draftFeatureCollection } from './draft-features';
import {
  DRAFT_FILTERS,
  DRAFT_RING_STYLE,
  DRAFT_SYMBOL_STYLE,
  makeDraftLabelStyle,
  makeRangeLabelStyle,
  makeRangeLineStyle,
} from './styles';

type Filter = ComponentProps<typeof SymbolLayer>['filter'];
const filter = (f: unknown) => f as Filter;

/** The in-progress point: symbol, dashed ring, NEW/EDIT chip, and range line from the user. */
export function DraftLayer() {
  const { colors } = useTheme();
  const mode = useDraft((s) => s.mode);
  const coord = useDraft((s) => s.coord);
  const affiliation = useDraft((s) => s.affiliation);
  const unitType = useDraft((s) => s.unitType);
  const category = useDraft((s) => s.category);
  const pointType = useDraft((s) => s.pointType);
  const name = useDraft((s) => s.name);
  const locked = useDraft((s) => s.locked);
  const self = usePresence((s) => s.selfPosition?.position ?? null);
  const angleUnit = useSettings((s) => s.angleUnit);
  const northRef = useSettings((s) => s.northRef);
  const declinationOverrideDeg = useSettings((s) => s.declinationOverrideDeg);

  const labelStyle = useMemo(() => makeDraftLabelStyle(colors), [colors]);
  const lineStyle = useMemo(() => makeRangeLineStyle(colors), [colors]);
  const rangeLabelStyle = useMemo(() => makeRangeLabelStyle(colors), [colors]);

  const shape = useMemo(() => {
    if (!mode || !coord) return draftFeatureCollection(null);
    const v = self ? describeVector(self, coord, { date: new Date(), declinationOverrideDeg, unit: angleUnit, ref: northRef }) : null;
    return draftFeatureCollection({
      coord,
      sidc: draftSidc({ category, affiliation, unitType, pointType }),
      // A selected (view-only) point shows just its name; drafts being placed or edited are tagged.
      label: locked ? name.trim() || '…' : `${name.trim() || '…'} · ${mode === 'add' ? 'NEW' : 'EDIT'}`,
      self,
      rangeLabel: v ? `${v.distanceLabel} · ${v.bearingLabel}` : null,
    });
  }, [mode, coord, category, affiliation, unitType, pointType, name, locked, self, angleUnit, northRef, declinationOverrideDeg]);

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
