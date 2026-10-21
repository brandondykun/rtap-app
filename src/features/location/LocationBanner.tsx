import { useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';

import { glassHalo } from '@/components/ui/glass';
import { Icon } from '@/components/ui/Icon';
import { usePresence } from '@/stores/presence';
import { useTheme } from '@/theme/ThemeProvider';

/** One dismissible notice when location is denied or unavailable; the map stays fully usable. Positioned by MapTopLeft. */
export function LocationBanner({ marginTop = 0 }: { marginTop?: number }) {
  const status = usePresence((s) => s.locationStatus);
  const [dismissed, setDismissed] = useState(false);
  const { colors } = useTheme();
  const halo = glassHalo(colors);
  if (dismissed || (status !== 'denied' && status !== 'unavailable')) return null;
  return (
    <View
      testID="location-banner"
      style={{ marginTop }}
      className="flex-row items-center gap-3 rounded-2xl bg-surface-glass px-4 py-3">
      <Text style={halo} className="flex-1 text-sm text-text">Location is off. Your position and range are hidden.</Text>
      <Pressable accessibilityRole="button" onPress={() => void Linking.openSettings()} hitSlop={8}>
        <Text style={halo} className="font-semibold text-accent">
          Settings
        </Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Dismiss" onPress={() => setDismissed(true)} hitSlop={8}>
        <Icon name="close" size={18} color={colors.text} style={halo} />
      </Pressable>
    </View>
  );
}
