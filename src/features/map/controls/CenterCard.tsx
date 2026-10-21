import { Text, View } from 'react-native';

import { CrosshairGlyph } from '@/components/ui/CrosshairGlyph';
import { useInteraction } from '@/stores/interaction';
import { useSettings } from '@/stores/settings';
import { useTheme } from '@/theme/ThemeProvider';

import { describeReadout } from '../interaction/readout';
import { useReadoutOrigin } from '../interaction/use-readout-origin';
import { CardLead } from './CardLead';
import { glassHalo } from './glass';

/**
 * Landscape: CTR and the crosshair's grid, then its distance and bearing from you, bottom left
 * (MapBottomLeft). Laid out like the ME card (grid, then a small second line) so the two match.
 * Portrait shows the same in the dock's CTR row instead.
 */
export function CenterCard({ onHeight }: { onHeight?: (height: number) => void }) {
  const { colors } = useTheme();
  const center = useInteraction((s) => s.cameraCenter);
  const { from, isOp } = useReadoutOrigin();
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
        <CardLead icon={<CrosshairGlyph size={14} />} tag="CTR" tagColor={colors.text} tagStyle={glassHalo(colors)} />
        <Text
          testID="readout-coordinate"
          style={glassHalo(colors)}
          className="shrink font-mono-bold text-sm text-text"
          adjustsFontSizeToFit
          numberOfLines={1}>
          {r.coordinate}
        </Text>
      </View>
      <Text
        testID="center-vector"
        accessibilityLabel={`Distance from ${isOp ? 'the OP' : 'you'} ${r.distance}, direction ${r.bearing} ${r.ref}`}
        style={glassHalo(colors)}
        // Full white with an outline, so it reads over bright ground.
        className="mt-0.5 font-mono text-xs text-text">
        {`DIST ${r.distance} · DIR ${r.bearing}${isOp ? ' FROM OP' : ''}`}
      </Text>
    </View>
  );
}
