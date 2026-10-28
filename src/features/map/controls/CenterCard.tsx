import { View } from 'react-native';

import { CrosshairGlyph } from '@/components/ui/CrosshairGlyph';
import { OutlinedText } from '@/components/ui/OutlinedText';
import { useInteraction } from '@/stores/interaction';
import { useSettings } from '@/stores/settings';
import { useTheme } from '@/theme/ThemeProvider';

import { describeReadout } from '../interaction/readout';
import { useReadoutOrigin } from '../interaction/use-readout-origin';
import { CardLead } from './CardLead';
import { glassHalo } from '@/components/ui/glass';

/**
 * Landscape: CTR and the crosshair's grid, then its distance and bearing from you, bottom left
 * (MapBottomLeft). Laid out like the ME card (grid, then a small second line) so the two match.
 * Portrait shows the same in the dock's CTR row instead.
 */
export function CenterCard({ onHeight }: { onHeight?: (height: number) => void }) {
  const { colors } = useTheme();
  const center = useInteraction((s) => s.cameraCenter);
  const { from, isOp, isManual } = useReadoutOrigin();
  const who = isOp ? 'the OP' : isManual ? 'you (manual position)' : 'you';
  const coordinateFormat = useSettings((s) => s.coordinateFormat);
  const angleUnit = useSettings((s) => s.angleUnit);
  const northRef = useSettings((s) => s.northRef);
  const declinationOverrideDeg = useSettings((s) => s.declinationOverrideDeg);
  const r = describeReadout(center, from, { coordinateFormat, angleUnit, northRef, declinationOverrideDeg }, new Date());
  return (
    <View
      testID="center-card"
      onLayout={onHeight ? (e) => onHeight(e.nativeEvent.layout.height) : undefined}
      // See-through, so it hides less of the map.
      className="rounded-2xl bg-surface-glass px-3 py-2">
      <View className="flex-row items-center gap-2">
        <CardLead icon={<CrosshairGlyph size={14} outline />} tag="CTR" tagColor={colors.text} tagStyle={glassHalo(colors)} outline />
        {/* A crisp dark edge as well as the soft one, so the grid reads over snow. */}
        <View className="shrink">
          <OutlinedText testID="readout-coordinate" color={colors.text} style={glassHalo(colors)} className="font-mono-bold text-sm" adjustsFontSizeToFit numberOfLines={1}>
            {r.coordinate}
          </OutlinedText>
        </View>
      </View>
      {/* Full white with a crisp dark edge, so it reads over bright ground. */}
      <View className="mt-0.5">
        <OutlinedText
          testID="center-vector"
          accessibilityLabel={`Distance from ${who} ${r.distance}, direction ${r.bearing} ${r.ref}`}
          color={colors.text}
          style={glassHalo(colors)}
          className="font-mono text-xs">
          {`DIST ${r.distance} · DIR ${r.bearing}${isOp ? ' FROM OP' : ''}`}
        </OutlinedText>
      </View>
    </View>
  );
}
