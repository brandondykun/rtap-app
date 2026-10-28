import { ShapeSource, SymbolLayer } from '@rnmapbox/maps';
import { useMemo } from 'react';

import { useManualEntry } from '@/stores/manual-entry';

import { selfFeatureCollection } from './self-feature';
import { SELF_STYLE } from './styles';

/** While the Set manually box is open: the grid in its fields, drawn with the manual self icon. Not tappable. */
export function ManualPreviewLayer() {
  const pending = useManualEntry((s) => (s.phase === 'entry' ? s.pending : null));
  const shape = useMemo(() => selfFeatureCollection(pending, null, true), [pending]);
  return (
    <ShapeSource id="manual-preview" shape={shape}>
      <SymbolLayer id="manual-preview-icon" style={SELF_STYLE} />
    </ShapeSource>
  );
}
