import { Pressable, Text, View } from 'react-native';

import { CrosshairGlyph } from '@/components/ui/CrosshairGlyph';
import { useInteraction } from '@/stores/interaction';
import { usePresence } from '@/stores/presence';
import { useSettings } from '@/stores/settings';
import { useTheme } from '@/theme/ThemeProvider';

import { describeReadout } from '../interaction/readout';

/** Crosshair MGRS, and range · bearing from the user (tap bearing: grid ↔ mag). Positioned by MapBottomLeft. */
export function ReadoutCard() {
  const { colors } = useTheme();
  const center = useInteraction((s) => s.cameraCenter);
  const self = usePresence((s) => s.selfPosition?.position ?? null);
  const coordinateFormat = useSettings((s) => s.coordinateFormat);
  const angleUnit = useSettings((s) => s.angleUnit);
  const northRef = useSettings((s) => s.northRef);
  const declinationOverrideDeg = useSettings((s) => s.declinationOverrideDeg);
  const toggleGridMagnetic = useSettings((s) => s.toggleGridMagnetic);

  const r = describeReadout(center, self, { coordinateFormat, angleUnit, northRef, declinationOverrideDeg }, new Date());

  return (
    <View testID="readout-card" className="self-start rounded-2xl border border-border bg-surface-chrome px-3 py-2">
      <View className="flex-row items-center gap-2">
        <CrosshairGlyph size={16} color={colors['text-muted']} />
        <Text testID="readout-coordinate" className="shrink font-mono-bold text-base text-text" adjustsFontSizeToFit numberOfLines={1}>
          {r.coordinate}
        </Text>
      </View>
      <View className="mt-0.5 flex-row items-center">
        <Text testID="readout-range" className="font-mono text-xs text-text-muted">{`${r.distance} ·`}</Text>
        <Pressable
          testID="readout-bearing"
          accessibilityRole="button"
          accessibilityLabel={`Bearing ${r.bearing} ${r.ref}. Tap to switch grid or magnetic.`}
          hitSlop={12}
          onPress={toggleGridMagnetic}
          className="ml-1">
          <Text className="font-mono text-xs text-text-muted">{`${r.bearing} ${r.ref}`}</Text>
        </Pressable>
      </View>
    </View>
  );
}
