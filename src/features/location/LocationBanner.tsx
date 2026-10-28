import { Linking, Pressable, Text, View } from 'react-native';

import { glassHalo } from '@/components/ui/glass';
import { Icon } from '@/components/ui/Icon';
import { useMyLocation } from '@/stores/my-location';
import { usePresence } from '@/stores/presence';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * The notice that location is denied or unavailable; the map stays fully usable. Closing it hides it for good. It also
 * stays hidden while a position set by hand stands in for GPS (that does not count as closing it). Positioned by
 * MapTopLeft.
 */
export function LocationBanner({ marginTop = 0 }: { marginTop?: number }) {
  const status = usePresence((s) => s.locationStatus);
  const closed = useMyLocation((s) => s.offNoticeClosed);
  const manualSet = useMyLocation((s) => s.source === 'manual' && s.manual !== null);
  const { colors } = useTheme();
  const halo = glassHalo(colors);
  if (closed || manualSet || (status !== 'denied' && status !== 'unavailable')) return null;
  return (
    <View
      testID="location-banner"
      style={{ marginTop }}
      className="flex-row items-center gap-3 rounded-2xl bg-surface-glass px-4 py-3">
      <Text style={halo} className="flex-1 text-sm text-text">
        Location is off, so your position and range are hidden. You can turn it on any time in Settings.
      </Text>
      <Pressable accessibilityRole="button" onPress={() => void Linking.openSettings()} hitSlop={8} className="active:opacity-60">
        <Text style={halo} className="font-semibold text-accent">
          Settings
        </Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Dismiss" onPress={() => useMyLocation.getState().closeOffNotice()} hitSlop={8} className="active:opacity-60">
        <Icon name="close" size={18} color={colors.text} style={halo} />
      </Pressable>
    </View>
  );
}
