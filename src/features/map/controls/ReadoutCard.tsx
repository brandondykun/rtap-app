import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/ui/Icon';
import { useInteraction } from '@/stores/interaction';
import { usePresence } from '@/stores/presence';
import { useSettings } from '@/stores/settings';
import { useTheme } from '@/theme/ThemeProvider';

import { describeReadout } from '../interaction/readout';
import { EDGE } from '../layout';

/** Bottom-left card: crosshair MGRS, and range · bearing from the user (tap bearing: grid ↔ mag). */
export function ReadoutCard() {
  const insets = useSafeAreaInsets();
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
    <View
      className="absolute rounded-2xl border border-border bg-surface-chrome px-4 py-3"
      style={{ left: insets.left + EDGE, bottom: insets.bottom + EDGE }}>
      <View className="flex-row items-center gap-2">
        <Icon name="crosshairs" size={18} color={colors['text-muted']} />
        <Text testID="readout-coordinate" className="font-mono-bold text-xl text-text">
          {r.coordinate}
        </Text>
      </View>
      <View className="mt-1 flex-row items-center">
        <Text testID="readout-range" className="font-mono text-sm text-text-muted">{`${r.distance} ·`}</Text>
        <Pressable
          testID="readout-bearing"
          accessibilityRole="button"
          accessibilityLabel={`Bearing ${r.bearing} ${r.ref}. Tap to switch grid or magnetic.`}
          hitSlop={12}
          onPress={toggleGridMagnetic}
          className="ml-1">
          <Text className="font-mono text-sm text-text-muted">{`${r.bearing} ${r.ref}`}</Text>
        </Pressable>
      </View>
    </View>
  );
}
