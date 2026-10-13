import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Full-screen About page (a route, not a menu). */
export function AboutScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const version = Constants.expoConfig?.version ?? '—';
  return (
    <View className="flex-1 bg-surface px-4" style={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 }}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} className="mb-6 self-start py-2" hitSlop={8}>
        <Text className="text-base text-text-muted">‹ Back</Text>
      </Pressable>
      <Text className="text-3xl font-bold tracking-widest text-text">RTAP</Text>
      <Text className="mt-1 text-base text-text-muted">Realtime Team Awareness Platform</Text>
      <Text className="mt-4 font-mono text-sm text-text-muted">{`Version ${version}`}</Text>
      <Text className="mt-6 text-sm text-text">For training and military simulation. Not for real-world military use.</Text>
      <Text className="mt-6 text-sm text-text-muted">
        Map data © Mapbox © OpenStreetMap. Symbols: milsymbol (MIL-STD-2525C). Magnetic model: WMM2025.
      </Text>
    </View>
  );
}
