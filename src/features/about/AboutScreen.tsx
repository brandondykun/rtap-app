import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/ui/Icon';
import { TOOLBAR_HELP } from '@/features/toolbar/toolbar-help';
import { useTheme } from '@/theme/ThemeProvider';

/** Readable line length on wide (landscape, tablet) screens. */
const MAX_CONTENT_WIDTH = 720;

/**
 * Full-screen About page (a route, not a menu): app info and what each toolbar button does. It draws
 * its own iOS-style header: the native iOS 26 back button flashes light as the page opens. Swipe back
 * (iOS) and the system back (Android) still work; they come from the navigator, not the header.
 */
export function AboutScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const version = Constants.expoConfig?.version ?? '—';
  return (
    <View className="flex-1 bg-surface">
      <View
        testID="about-header"
        className="border-b border-border bg-surface"
        style={{ paddingTop: insets.top, paddingLeft: insets.left + 8, paddingRight: insets.right + 8 }}>
        <View className="h-11 flex-row items-center">
          <Text
            accessibilityRole="header"
            className="absolute left-0 right-0 text-center text-lg font-semibold text-text"
            pointerEvents="none">
            About
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            onPress={() => router.back()}
            hitSlop={8}
            className="min-h-11 min-w-11 flex-row items-center pr-2 active:opacity-50">
            <Icon name="chevron-left" size={32} color={colors.text} />
            <Text className="-ml-1 text-lg text-text">Back</Text>
          </Pressable>
        </View>
      </View>
      <ScrollView
        testID="about-scroll"
        contentContainerStyle={{
          paddingTop: 16,
          paddingBottom: insets.bottom + 24,
          // Clear of the notch and rounded corners in landscape.
          paddingLeft: insets.left + 16,
          paddingRight: insets.right + 16,
        }}>
        <View className="w-full self-center" style={{ maxWidth: MAX_CONTENT_WIDTH }}>
          <Text className="text-3xl font-bold tracking-widest text-text">RTAP</Text>
          <Text className="mt-1 text-base text-text-muted">Realtime Team Awareness Platform</Text>
          <Text className="mt-4 font-mono text-sm text-text-muted">{`Version ${version}`}</Text>
          <Text className="mt-6 text-sm text-text">For training and military simulation. Not for real-world military use.</Text>

          <Text accessibilityRole="header" className="mb-3 mt-10 text-sm font-bold uppercase tracking-widest text-text-muted">
            Toolbar
          </Text>
          <View className="overflow-hidden rounded-2xl border border-border bg-surface-raised">
            {TOOLBAR_HELP.map((h, i) => (
              <View
                key={h.label}
                testID={`help-${h.label}`}
                accessible
                className={`flex-row items-start gap-3 px-4 py-3 ${i > 0 ? 'border-t border-border' : ''}`}>
                {/* Same icon over name as the toolbar button. */}
                <View className="w-16 items-center gap-0.5">
                  <Icon name={h.icon} size={22} color={colors.text} />
                  <Text className="text-[10px] font-semibold uppercase tracking-wider text-text">{h.label}</Text>
                </View>
                <Text className="flex-1 text-sm text-text">{h.help}</Text>
              </View>
            ))}
          </View>

          <Text className="mt-10 text-sm text-text-muted">
            Map data © Mapbox © OpenStreetMap. Symbols: milsymbol (MIL-STD-2525C). Magnetic model: WMM2025.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
