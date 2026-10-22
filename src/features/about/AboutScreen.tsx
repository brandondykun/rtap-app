import Ionicons from '@expo/vector-icons/Ionicons';
import Constants from 'expo-constants';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/ui/Icon';
import { CrosshairGlyph } from '@/components/ui/CrosshairGlyph';
import { SETTINGS_HELP, type SettingHelp } from '@/features/menus/menus/settings-help';
import { HELP_GROUPS, TOOLBAR_HELP, type ToolbarHelp } from '@/features/toolbar/toolbar-help';
import { useTheme } from '@/theme/ThemeProvider';

const APP_ICON = require('../../../assets/images/icon.png');

/** Readable line length on wide (landscape, tablet) screens. */
const MAX_CONTENT_WIDTH = 720;

/**
 * Full-screen About page (a route, not a menu): app info, what each toolbar button does and what each setting does. It draws
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
        className="bg-surface pb-2"
        style={{ paddingTop: insets.top, paddingLeft: insets.left + 8, paddingRight: insets.right + 8 }}>
        <View className="h-11 flex-row items-center">
          <Text
            accessibilityRole="header"
            className="absolute left-0 right-0 text-center text-2xl font-semibold text-text"
            pointerEvents="none">
            About
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            onPress={() => router.back()}
            hitSlop={8}
            className="min-h-11 min-w-11 flex-row items-center pr-2 active:opacity-60">
            {/* Ionicons' chevron is the thin iOS one (the Material chevron is too heavy). */}
            <Ionicons testID="about-back-chevron" name="chevron-back" size={26} color={colors.text} />
            <Text className="text-2xl text-text">Back</Text>
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
        <View className="w-full gap-6 self-center" style={{ maxWidth: MAX_CONTENT_WIDTH }}>
          <IdentityCard version={version} />
          <View testID="about-warning" accessible className="flex-row items-start gap-3 rounded-2xl border border-accent bg-accent-subtle px-4 py-3">
            <Icon name="alert-outline" size={24} color={colors.accent} />
            <View className="flex-1">
              <Text className="text-sm font-bold uppercase tracking-widest text-accent">Training & simulation only</Text>
              <Text className="mt-0.5 text-base text-text">Not for real-world military use or targeting.</Text>
            </View>
          </View>

          <View className="gap-2">
            <SectionTitle>Toolbar guide</SectionTitle>
            <View testID="about-tip" accessible className="flex-row items-center gap-4 rounded-2xl border border-border bg-surface-input px-4 py-4">
              <CrosshairGlyph size={44} />
              <Text className="flex-1 text-base text-text">
                <Text className="font-bold">Two ways to place anything:</Text>
                {' tap the map, or line up the crosshair and press '}
                <Text className="font-bold text-accent">CTR</Text>
                {' for precision.'}
              </Text>
            </View>
          </View>

          {HELP_GROUPS.map((group) => (
            <View key={group.id} className="gap-2">
              <SectionTitle>{group.title}</SectionTitle>
              <View className="overflow-hidden rounded-2xl border border-border bg-surface-raised">
                {TOOLBAR_HELP.filter((h) => h.group === group.id).map((h, i) => (
                  <HelpRow key={h.label} help={h} first={i === 0} />
                ))}
              </View>
            </View>
          ))}

          <View className="gap-2">
            <SectionTitle>Settings guide</SectionTitle>
            <View className="overflow-hidden rounded-2xl border border-border bg-surface-raised">
              {SETTINGS_HELP.map((h, i) => (
                <SettingRow key={h.name} help={h} first={i === 0} />
              ))}
            </View>
          </View>

          <Text className="text-center text-xs text-text-muted">
            Map data © Mapbox © OpenStreetMap. Symbols: milsymbol (MIL-STD-2525C). Magnetic model: WMM2025.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

function SectionTitle({ children }: { children: string }) {
  return (
    <Text accessibilityRole="header" className="ml-1 text-sm font-bold uppercase tracking-widest text-text-muted">
      {children}
    </Text>
  );
}

function IdentityCard({ version }: { version: string }) {
  return (
    <View testID="about-identity" className="gap-3 rounded-2xl border border-border bg-surface-raised p-4">
      <View className="flex-row items-center gap-4">
        {/* The app's own icon, rounded like on the home screen; the border lifts its dark tile off the card. */}
        <Image
          testID="about-app-icon"
          source={APP_ICON}
          accessibilityLabel="RTAP app icon"
          className="h-16 w-16 rounded-2xl border border-border"
          style={{ width: 64, height: 64, borderRadius: 16 }}
        />
        <View className="flex-1">
          <Text className="text-4xl font-bold tracking-widest text-accent">RTAP</Text>
          <Text className="text-base text-text">Realtime Team Awareness Platform</Text>
        </View>
      </View>
      <Text className="text-base text-text">Built by military and geospatial professionals.</Text>
      <View className="self-start rounded-full border border-border px-3 py-1">
        <Text className="font-mono text-sm text-text">{`Version ${version}`}</Text>
      </View>
    </View>
  );
}

/** One toolbar button: its icon in a tile, its name and what it does. */
function HelpRow({ help, first }: { help: ToolbarHelp; first: boolean }) {
  const { colors } = useTheme();
  return (
    <View testID={`help-${help.label}`} accessible className={`flex-row items-center gap-4 px-3 py-3 ${first ? '' : 'border-t border-border'}`}>
      <View testID={`help-tile-${help.label}`} className="h-12 w-12 items-center justify-center rounded-xl border border-border bg-surface-input">
        <Icon testID={`help-icon-${help.label}`} name={help.icon} size={24} color={colors.text} />
      </View>
      <View className="flex-1">
        <Text className="text-base font-bold uppercase tracking-widest text-text">{help.label}</Text>
        <Text className="text-base text-text">{help.help}</Text>
      </View>
    </View>
  );
}

/** One setting: its name as in the Settings menu, its choices and what it does. */
function SettingRow({ help, first }: { help: SettingHelp; first: boolean }) {
  return (
    <View testID={`setting-help-${help.name}`} accessible className={`gap-0.5 px-4 py-3 ${first ? '' : 'border-t border-border'}`}>
      <Text className="text-base font-bold uppercase tracking-widest text-text">{help.name}</Text>
      {help.choices ? <Text className="font-mono text-sm text-text-muted">{help.choices}</Text> : null}
      <Text className="text-base text-text">{help.help}</Text>
    </View>
  );
}
