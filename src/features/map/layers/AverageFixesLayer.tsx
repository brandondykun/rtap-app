import { CircleLayer, LineLayer, ShapeSource } from '@rnmapbox/maps';
import { useMemo } from 'react';

import { useGpsAverage } from '@/stores/gps-average';
import { usePresence } from '@/stores/presence';
import { useTheme } from '@/theme/ThemeProvider';

import { averageFixFeatures, averageRingFeatures } from './average-fixes-features';
import { makeAverageFixDotStyle, makeAverageRingStyle } from './styles';

/**
 * The fixes behind the averaged position, while Average mode is on and they are switched on from the fix count. Always
 * mounted (empty when hidden) so it keeps its place in the layer order, under the self icon (MissionMap mounts it first).
 */
export function AverageFixesLayer() {
  const { colors } = useTheme();
  const shown = useGpsAverage((s) => s.showFixes && s.phase !== 'off');
  const fixes = useGpsAverage((s) => s.fixes);
  // The average as published: its ± matches the AVG row, held while paused.
  const average = usePresence((s) => (s.selfPosition?.averaged ? s.selfPosition : null));
  const points = useMemo(() => averageFixFeatures(shown ? fixes : []), [shown, fixes]);
  const ring = useMemo(
    () => averageRingFeatures(shown ? (average?.position ?? null) : null, average?.accuracyM ?? null),
    [shown, average?.position, average?.accuracyM],
  );
  const styles = useMemo(
    () => ({ dot: makeAverageFixDotStyle(colors), ring: makeAverageRingStyle(colors) }),
    [colors],
  );
  return (
    <>
      <ShapeSource id="average-fixes" shape={points}>
        <CircleLayer id="average-fix-dots" style={styles.dot} />
      </ShapeSource>
      <ShapeSource id="average-ring" shape={ring}>
        <LineLayer id="average-ring-line" style={styles.ring} />
      </ShapeSource>
    </>
  );
}
