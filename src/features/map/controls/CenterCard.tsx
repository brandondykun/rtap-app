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
      // In OP mode the card is see-through, so it hides less of the view.
      className={`rounded-2xl px-3 py-2 ${isOp ? 'bg-surface-glass' : 'border border-border bg-surface-chrome'}`}>
      <View className="flex-row items-center gap-2">
        <CardLead icon={<CrosshairGlyph size={14} />} tag="CTR" tagColor={isOp ? colors.text : undefined} tagStyle={glassHalo(isOp, colors)} />
        <Text
          testID="readout-coordinate"
          style={glassHalo(isOp, colors)}
          className="shrink font-mono-bold text-sm text-text"
          adjustsFontSizeToFit
          numberOfLines={1}>
          {r.coordinate}
        </Text>
      </View>
      <Text
        testID="center-vector"
        accessibilityLabel={`Distance from ${isOp ? 'the OP' : 'you'} ${r.distance}, direction ${r.bearing} ${r.ref}`}
        style={glassHalo(isOp, colors)}
        // On the see-through OP card it is full white with an outline, so it reads over bright ground.
        className={`mt-0.5 font-mono text-xs ${isOp ? 'text-text' : 'text-text-muted'}`}>
        {`DIST ${r.distance} · DIR ${r.bearing}${isOp ? ' FROM OP' : ''}`}
      </Text>
    </View>
  );
}
