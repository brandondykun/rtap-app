import { Pressable, Text, View } from 'react-native';

/** Development-time error: the app was built or started without EXPO_PUBLIC_MAPBOX_TOKEN. */
export function MissingTokenScreen({ onBack }: { onBack: () => void }) {
  return (
    <View className="flex-1 items-center justify-center gap-3 bg-surface px-8">
      <Text className="text-lg font-semibold text-danger">Mapbox token missing</Text>
      <Text className="text-center text-sm text-text-muted">
        Add EXPO_PUBLIC_MAPBOX_TOKEN to .env and restart Metro with --clear.
      </Text>
      <Pressable accessibilityRole="button" onPress={onBack} className="mt-2 rounded-xl bg-surface-raised px-6 py-3">
        <Text className="font-semibold text-text">Back to missions</Text>
      </Pressable>
    </View>
  );
}
