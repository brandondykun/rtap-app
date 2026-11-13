import Ionicons from '@expo/vector-icons/Ionicons';
import Constants from 'expo-constants';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import * as Updates from 'expo-updates';
import { useRef, useState } from 'react';
import { Linking, Pressable, ScrollView, Text, useWindowDimensions, View, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/ui/Icon';
import { CrosshairGlyph } from '@/components/ui/CrosshairGlyph';
import { AVERAGE_HELP } from '@/features/location/average-help';
import { SETTINGS_HELP, type SettingHelp } from '@/features/menus/menus/settings-help';
import { OVERLAYS_HELP, type OverlayHelp } from '@/features/overlays/overlays-help';
import { HELP_GROUPS, TOOLBAR_HELP, type ToolbarHelp } from '@/features/toolbar/toolbar-help';
import { useTheme } from '@/theme/ThemeProvider';
import { VALUE_COLOR_GUIDE, type ValueColorGuide } from '@/theme/value-colors';

import { isLandscape } from '@/features/map/layout';

import { ITEMS_HELP, MAP_HELP, MISSIONS_HELP } from './about-help';
import { updateLabel } from './update-label';

const APP_ICON = require('../../../assets/images/icon.png');

/** The company's website, opened in the phone's browser. */
export const COMPANY_URL = 'https://eratas.dev';

/** The page's sections, in order, for the contents card at the top: each row scrolls to its section. */
export const ABOUT_CONTENTS = [
  { id: 'toolbar', title: 'Toolbar guide', summary: 'What each toolbar button does' },
  { id: 'map', title: 'The map screen', summary: 'The crosshair, your position, map buttons and menus' },
  { id: 'items', title: 'Working with items', summary: 'Adding, viewing and editing units, points, lines and polygons' },
  { id: 'missions', title: 'Missions', summary: 'Switching, creating and managing missions' },
  { id: 'overlays', title: 'Overlays', summary: 'Grouping items to show and hide them together' },
  { id: 'average', title: 'Average mode', summary: 'A steadier, more accurate position' },
  { id: 'colors', title: 'Reading the colors', summary: 'What each value color means' },
  { id: 'settings', title: 'Settings guide', summary: 'What each setting does' },
] as const;
type SectionId = (typeof ABOUT_CONTENTS)[number]['id'];

/** A section's number on this page ("01"), shown both in the contents and on its heading. */
const sectionNumber = (id: SectionId) => String(ABOUT_CONTENTS.findIndex((c) => c.id === id) + 1).padStart(2, '0');

/** The scroll content's top padding: the sections' offsets are measured inside it. */
const CONTENT_TOP = 16;

/** Extra room above the header in landscape, where iOS hides the status bar and the top inset drops to 0. */
export const LANDSCAPE_HEADER_TOP = 12;

/** Readable line length on wide (landscape, tablet) screens. */
const MAX_CONTENT_WIDTH = 720;

/**
 * Full-screen About page (a route, not a menu): app info, what each toolbar button does, the map screen, items, missions,
 * overlays, Average mode, the value colors and what each setting does. It draws
 * its own iOS-style header: the native iOS 26 back button flashes light as the page opens. Swipe back
 * (iOS) and the system back (Android) still work; they come from the navigator, not the header.
 */
export function AboutScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const headerTop = insets.top + (isLandscape(width, height) ? LANDSCAPE_HEADER_TOP : 0);
  const { colors } = useTheme();
  const version = Constants.expoConfig?.version ?? '—';
  const scroll = useRef<ScrollView>(null);
  // Where each section sits, so its contents row can scroll to it. Kept across renders; changing it redraws nothing.
  const [offsets] = useState(() => new Map<SectionId, number>());
  const at = (id: SectionId) => (e: LayoutChangeEvent) => void offsets.set(id, e.nativeEvent.layout.y);
  const goTo = (id: SectionId) => {
    const y = offsets.get(id);
    // The section's title lands with the same room above it as the page's own top.
    if (y !== undefined) scroll.current?.scrollTo({ y, animated: true });
  };
  return (
    <View className="flex-1 bg-surface">
      <View
        testID="about-header"
        className="bg-surface pb-2"
        style={{ paddingTop: headerTop, paddingLeft: insets.left + 8, paddingRight: insets.right + 8 }}>
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
        ref={scroll}
        testID="about-scroll"
        contentContainerStyle={{
          paddingTop: CONTENT_TOP,
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
            <SectionTitle>On this page</SectionTitle>
            <View testID="about-contents" className="overflow-hidden rounded-2xl border border-border bg-surface-raised">
              {ABOUT_CONTENTS.map((c, i) => (
                <Pressable
                  key={c.id}
                  testID={`contents-${c.id}`}
                  accessibilityRole="button"
                  accessibilityLabel={c.title}
                  accessibilityHint={`Jumps to this section: ${c.summary}`}
                  onPress={() => goTo(c.id)}
                  // A table of contents, not a list of screens: numbered like the page's order, with a down arrow (no
                  // chevron, which reads as opening another screen) and the title in the page's link amber.
                  className={`min-h-11 flex-row items-center gap-3 px-4 py-2.5 active:opacity-60 ${i === 0 ? '' : 'border-t border-border'}`}>
                  <Text className="w-6 font-mono text-sm text-text-muted">{sectionNumber(c.id)}</Text>
                  <View className="flex-1">
                    <Text className="text-base font-semibold text-accent">{c.title}</Text>
                    <Text className="text-sm text-text-muted">{c.summary}</Text>
                  </View>
                  <Icon name="arrow-down" size={16} color={colors['text-muted']} />
                </Pressable>
              ))}
            </View>
          </View>

          <View className="gap-2" onLayout={at('toolbar')}>
            <SectionTitle section="toolbar" />
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
              <SubsectionTitle>{group.title}</SubsectionTitle>
              <View className="overflow-hidden rounded-2xl border border-border bg-surface-raised">
                {TOOLBAR_HELP.filter((h) => h.group === group.id).map((h, i) => (
                  <HelpRow key={h.label} help={h} first={i === 0} />
                ))}
              </View>
            </View>
          ))}

          <View className="gap-2" onLayout={at('map')}>
            <SectionTitle section="map" />
            <HelpList testID="about-map" itemTestID="map-help" items={MAP_HELP} />
          </View>

          <View className="gap-2" onLayout={at('items')}>
            <SectionTitle section="items" />
            <HelpList testID="about-items" itemTestID="items-help" items={ITEMS_HELP} />
          </View>

          <View className="gap-2" onLayout={at('missions')}>
            <SectionTitle section="missions" />
            <HelpList testID="about-missions" itemTestID="missions-help" items={MISSIONS_HELP} />
          </View>

          <View className="gap-2" onLayout={at('overlays')}>
            <SectionTitle section="overlays" />
            <HelpList testID="about-overlays" itemTestID="overlay-help" items={OVERLAYS_HELP} />
          </View>

          <View className="gap-2" onLayout={at('average')}>
            <SectionTitle section="average" />
            <HelpList testID="about-average" itemTestID="average-help" items={AVERAGE_HELP} />
          </View>

          <View className="gap-2" onLayout={at('colors')}>
            <SectionTitle section="colors" />
            <Text testID="about-colors-intro" className="ml-1 text-base text-text-body">
              Each kind of value has one color everywhere it shows, on the map, in the readouts and in the menus, so you can tell
              them apart at a glance.
            </Text>
            <View className="overflow-hidden rounded-2xl border border-border bg-surface-raised">
              {VALUE_COLOR_GUIDE.map((g, i) => (
                <ColorRow key={g.name} guide={g} first={i === 0} />
              ))}
            </View>
          </View>

          <View className="gap-2" onLayout={at('settings')}>
            <SectionTitle section="settings" />
            <View className="overflow-hidden rounded-2xl border border-border bg-surface-raised">
              {SETTINGS_HELP.map((h, i) => (
                <SettingRow key={h.name} help={h} first={i === 0} />
              ))}
            </View>
          </View>

          <View className="items-center gap-1">
            <Text testID="about-built-by" className="text-center text-sm text-text-muted">
              Built by <Text className="font-semibold text-text">Eratas Software LLC</Text>
            </Text>
            <Pressable
              accessibilityRole="link"
              accessibilityLabel="eratas.dev, opens in your browser"
              // Nothing to do if no browser can open it.
              onPress={() => void Linking.openURL(COMPANY_URL).catch(() => {})}
              hitSlop={8}
              className="min-h-11 flex-row items-center gap-1 px-2 active:opacity-60">
              <Text className="text-base font-semibold text-accent">eratas.dev</Text>
              <Icon name="open-in-new" size={16} color={colors.accent} />
            </Pressable>
          </View>
          <Text className="text-center text-xs text-text-muted">
            Map data © Mapbox © OpenStreetMap. Symbols: milsymbol (MIL-STD-2525C). Magnetic model: WMM2025.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

/** Titled points in one card, each read out as one item. */
function HelpList({ testID, itemTestID, items }: { testID: string; itemTestID: string; items: readonly OverlayHelp[] }) {
  return (
    <View testID={testID} className="overflow-hidden rounded-2xl border border-border bg-surface-raised">
      {items.map((h, i) => (
        <View key={h.title} testID={`${itemTestID}-${h.title}`} accessible className={`gap-0.5 px-4 py-3 ${i === 0 ? '' : 'border-t border-border'}`}>
          <Text className="text-base font-bold uppercase tracking-widest text-text">{h.title}</Text>
          <Text className="text-base text-text-body">{h.help}</Text>
        </View>
      ))}
    </View>
  );
}

/**
 * A heading, a step above the 16 pt titles inside the cards. A contents `section` takes its number and title from
 * ABOUT_CONTENTS, so they always match its row there: the number muted, the title amber.
 */
function SectionTitle(props: { section: SectionId } | { children: string }) {
  const entry = 'section' in props ? ABOUT_CONTENTS.find((c) => c.id === props.section)! : null;
  const title = entry ? entry.title : (props as { children: string }).children;
  return (
    <Text accessibilityRole="header" accessibilityLabel={title} className="ml-1 text-lg font-bold uppercase tracking-widest text-accent">
      {entry ? <Text className="font-mono text-text-muted">{`${sectionNumber(entry.id)}  `}</Text> : null}
      {title}
    </Text>
  );
}

/** A heading within a section (the toolbar guide's groups): small and muted, so it reads as part of the section above. */
function SubsectionTitle({ children }: { children: string }) {
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
      <Text testID="about-update" className="font-mono text-sm text-text-muted">
        {updateLabel(Updates)}
      </Text>
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
        <Text className="text-base text-text-body">{help.help}</Text>
      </View>
    </View>
  );
}

/** One value color: a sample in its color on a dark tile (like the map's panels), what it is and where it shows. */
function ColorRow({ guide, first }: { guide: ValueColorGuide; first: boolean }) {
  const { colors } = useTheme();
  return (
    <View testID={`color-help-${guide.name}`} accessible className={`gap-1.5 px-4 py-3 ${first ? '' : 'border-t border-border'}`}>
      <View className="flex-row items-center gap-3">
        <View className="rounded-lg bg-surface-input px-2.5 py-1">
          <Text testID={`color-sample-${guide.name}`} style={{ color: colors[guide.token] }} className="font-mono-bold text-base">
            {guide.sample}
          </Text>
        </View>
        <Text className="text-base font-bold uppercase tracking-widest text-text">{guide.name}</Text>
      </View>
      <Text className="text-base text-text-body">{guide.help}</Text>
    </View>
  );
}

/** One setting: its name as in the Settings menu, its choices and what it does. */
function SettingRow({ help, first }: { help: SettingHelp; first: boolean }) {
  return (
    <View testID={`setting-help-${help.name}`} accessible className={`gap-0.5 px-4 py-3 ${first ? '' : 'border-t border-border'}`}>
      <Text className="text-base font-bold uppercase tracking-widest text-text">{help.name}</Text>
      {help.choices ? <Text className="font-mono text-sm text-text-muted">{help.choices}</Text> : null}
      <Text className="text-base text-text-body">{help.help}</Text>
    </View>
  );
}
