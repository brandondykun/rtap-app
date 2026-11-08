import { Canvas, DashPathEffect, Group, Path } from '@shopify/react-native-skia';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import Animated, { cancelAnimation, Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming, type SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/components/ui/Icon';
import { isLandscape } from '@/features/map/layout';
import { composeSidc } from '@/features/symbology/presets';
import { formatAngle, formatDistance } from '@/lib/geo/format/measure';
import { SymbolImage } from '@/features/symbology/SymbolImage';
import { useProfile } from '@/stores/profile';
import { useTheme } from '@/theme/ThemeProvider';

import { circlePath, contourPaths, gridLines, landingFit, sceneLayout, sceneScale, screenBearingDeg, type Pt } from './landing-art';

/**
 * The scene plays out in turn: ALPHA-1's measure line draws itself in after the screen settles and its label fades in;
 * as it reaches the hostile, the hostile's ring fades in and it starts pinging; ALPHA-1 then passes the sighting on, a
 * dashed blue line drawing in to BRAVO-2; once that arrives, BRAVO-2's own line draws in to the hostile and its label
 * fades in.
 */
const LINE_DELAY_MS = 500;
const LINE_MS = 1_200;
const LABEL_MS = 400;
/** The ring around the hostile, and the thin ping that grows out of it and fades, once every PING_MS. */
const RING_RADIUS = 54;
const PING_MS = 2_400;
const PING_DELAY_MS = LINE_DELAY_MS + LINE_MS;
/** The ring fades in this fast as ALPHA-1's line reaches the hostile. */
const RING_IN_MS = 300;
/** ALPHA-1's report to BRAVO-2 sets off just after the pinging starts; BRAVO-2 measures once it has arrived. */
const REPORT_DELAY_MS = PING_DELAY_MS + 300;
const SECOND_LINE_DELAY_MS = REPORT_DELAY_MS + LINE_MS + 200;
/** ALPHA-1's distance to the hostile; BRAVO-2's is scaled from it by how far apart they sit on screen. */
const FIRST_DISTANCE_KM = 1.24;
const PING_FROM = 0.3;
const PING_TO = 1.9;
const SYMBOL = { width: 52, height: 40 };
/** Grid numbers: the first column's easting and the bottom row's northing (two-digit, as on a map sheet's margin). */
const FIRST_EASTING = 70;
const FIRST_NORTHING = 60;

/** The least height the scene keeps in portrait; with less to spare (very large text) the screen scrolls instead. */
const SCENE_MIN_HEIGHT = 200;

/** The app icon's symbol on its own (no black tile), cropped to its edges, and its width over its height. */
const LOGO_MARK = require('../../../assets/images/logo-mark.png');
const LOGO_ASPECT = 521 / 582;

const FEATURES: readonly { icon: IconName; text: string }[] = [
  { icon: 'target', text: 'MGRS grids to the meter' },
  { icon: 'rhombus-outline', text: 'Units, points, lines and areas' },
  { icon: 'ruler', text: 'Range and azimuth at a glance' },
];

type Frame = { x: number; y: number; width: number; height: number };

/**
 * The first-launch landing screen: RTAP over contours and a numbered grid, a small scene of the map at
 * work (two friendly units, a hostile pinging inside its ring, the measure line between), what the app does, and Get
 * started into the missions. Later it can offer log in and sign up. Portrait stacks it; landscape puts the words and the
 * button left and the scene right. Short screens tighten it (see landingFit), and anything still too tall scrolls.
 */
export function LandingScreen() {
  const { width, height, fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors } = useTheme();
  const landscape = isLandscape(width, height);
  const fit = landingFit(height - insets.top - insets.bottom, landscape, fontScale);
  const compact = fit !== 'roomy';
  // Where the scene sits on screen, less how far the page has scrolled: the grid numbers its lines there.
  const [scene, setScene] = useState<Frame | null>(null);
  const [scrollY, setScrollY] = useState(0);
  const getStarted = () => {
    useProfile.getState().markLandingSeen();
    router.replace('/');
  };

  // A little shorter than the wordmark's capitals, and raised a touch (a twelfth of its height): centered on the line,
  // it sat low beside them.
  const logo = landscape ? (compact ? 32 : 40) : compact ? 40 : 48;
  const wordmark = landscape ? (compact ? 48 : 60) : compact ? 56 : 72;
  const title = (
    <View testID="landing-title">
      <Text className="font-mono-bold text-sm tracking-[5px] text-accent">◆ TACTICAL MAPPING</Text>
      <View className="mt-2 flex-row items-center gap-3">
        <Image testID="landing-logo" source={LOGO_MARK} accessibilityLabel="RTAP logo" resizeMode="contain" style={{ width: logo * LOGO_ASPECT, height: logo, transform: [{ translateY: -logo / 12 }] }} />
        <Text accessibilityRole="header" style={{ fontSize: wordmark, lineHeight: Math.round(wordmark * 1.16) }} className="font-mono-bold tracking-[6px] text-text">
          RTAP
        </Text>
      </View>
      <Text className="font-mono text-xs tracking-[1px] text-text-muted">Realtime Team Awareness Platform</Text>
      <Text className={`${compact ? 'mt-2 text-lg' : 'mt-4 text-xl'} font-mono-bold text-text`}>
        {'Locate. Communicate. '}
        <Text className="text-accent">Dominate.</Text>
      </Text>
    </View>
  );
  const features = fit === 'tight' ? null : (
    <View testID="landing-features" className={compact ? 'gap-2' : 'gap-3'}>
      {FEATURES.map((f) => (
        <View key={f.text} className="flex-row items-center gap-3.5">
          <View className={`${compact ? 'h-7 w-7' : 'h-8 w-8'} items-center justify-center rounded-lg border border-border`}>
            <Icon name={f.icon} size={16} color={colors.accent} />
          </View>
          <Text className={`flex-1 font-mono text-text ${compact ? 'text-sm' : 'text-base'}`}>{f.text}</Text>
        </View>
      ))}
    </View>
  );
  const button = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Get started"
      onPress={getStarted}
      className="active:opacity-60 h-14 flex-row items-center justify-between rounded-2xl bg-accent px-6">
      <Text className="font-mono-bold text-lg tracking-[4px] text-on-accent">GET STARTED</Text>
      <Icon name="arrow-right" size={24} color={colors['on-accent']} />
    </Pressable>
  );
  const padding = { paddingTop: insets.top + (landscape || compact ? 20 : 32), paddingBottom: insets.bottom + 16, paddingLeft: insets.left + 28, paddingRight: insets.right + 28 };

  return (
    <View testID="landing-screen" className="flex-1 overflow-hidden bg-surface-sunken">
      <Contours width={width} height={height} />
      <Grid width={width} height={height} scene={scene && { ...scene, y: scene.y - scrollY }} landscape={landscape} top={insets.top} left={insets.left} right={insets.right} />
      <ScrollView
        testID="landing-scroll"
        contentContainerStyle={{ flexGrow: 1 }}
        alwaysBounceVertical={false}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={(e) => setScrollY(e.nativeEvent.contentOffset.y)}>
        {landscape ? (
          <View testID="landing-landscape" className={`flex-1 flex-row ${compact ? 'gap-6' : 'gap-10'}`} style={padding}>
            <View className={`w-[340px] justify-between ${compact ? 'gap-4' : 'gap-6'}`}>
              {title}
              <View className={compact ? 'gap-4' : 'gap-6'}>
                {features}
                {button}
              </View>
            </View>
            <Scene onFrame={setScene} />
          </View>
        ) : (
          <View testID="landing-portrait" className={`flex-1 ${compact ? 'gap-4' : 'gap-6'}`} style={padding}>
            {title}
            <Scene onFrame={setScene} minHeight={SCENE_MIN_HEIGHT} />
            {features}
            {button}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

/** The background: faint amber contours, still. */
function Contours({ width, height }: { width: number; height: number }) {
  const { colors } = useTheme();
  const contours = useMemo(() => contourPaths(width, height), [width, height]);
  return (
    <View testID="landing-contours" pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, width, height }}>
      <Canvas style={{ width, height }}>
        {contours.map((d) => (
          <Path key={d} path={d} style="stroke" strokeWidth={1} color={colors.accent} opacity={0.14} />
        ))}
      </Canvas>
    </View>
  );
}

/**
 * The grid over the whole screen, still, numbered like a map sheet where its lines cross the scene: eastings along the
 * scene's top (the screen's top in landscape), northings at the screen's edge (left in portrait, right in landscape).
 */
function Grid({ width, height, scene, landscape, top, left, right }: { width: number; height: number; scene: Frame | null; landscape: boolean; top: number; left: number; right: number }) {
  const { colors } = useTheme();
  const grid = useMemo(() => gridLines(width, height), [width, height]);
  const label = 'absolute font-mono text-[11px] text-text-muted';
  return (
    <View testID="landing-grid" pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, width, height }}>
      <Canvas style={{ width, height }}>
        <Path path={grid.path} style="stroke" strokeWidth={1} color={colors.text} opacity={0.08} />
      </Canvas>
      {scene
        ? grid.xs.map((x, i) =>
            x > scene.x && x < scene.x + scene.width ? (
              <Text key={`e${x}`} className={label} style={{ left: x + 4, top: landscape ? top + 4 : (grid.ys.find((y) => y >= scene.y) ?? scene.y) - 18 }}>
                {FIRST_EASTING + i}
              </Text>
            ) : null,
          )
        : null}
      {scene
        ? grid.ys.map((y, i) =>
            y > scene.y && y < scene.y + scene.height ? (
              <Text key={`n${y}`} className={label} style={{ top: y - 16, ...(landscape ? { right: right + 4 } : { left: left + 4 }) }}>
                {FIRST_NORTHING + grid.ys.length - 1 - i}
              </Text>
            ) : null,
          )
        : null}
    </View>
  );
}

/**
 * The map at work, filling the room it is given, played out in turn: ALPHA-1 measures to a hostile (the line draws
 * itself in, its range and mils label after), the hostile's dashed ring fades in as the line reaches it and it starts
 * pinging (a thin ring grows out of it and fades), ALPHA-1 reports it to BRAVO-2 (a dashed blue line), then BRAVO-2
 * measures to it too. Reports its frame on screen
 * (`onFrame`) so the grid can number its lines.
 */
function Scene({ onFrame, minHeight }: { onFrame: (frame: Frame) => void; minHeight?: number }) {
  const { colors } = useTheme();
  const [box, setBox] = useState({ width: 0, height: 0 });
  const at = sceneLayout(box.width, box.height);
  // A short or narrow box draws the ring and units smaller, so they keep clear of each other.
  const k = sceneScale(box.width, box.height);
  const ringRadius = Math.round(RING_RADIUS * k);
  const symbol = { width: Math.round(SYMBOL.width * k), height: Math.round(SYMBOL.height * k) };
  const first = useMeasureIn(LINE_DELAY_MS);
  const report = useMeasureIn(REPORT_DELAY_MS);
  const second = useMeasureIn(SECOND_LINE_DELAY_MS);
  // Hidden until ALPHA-1's line reaches the hostile.
  const ring = useSharedValue(0);
  // Out of sight (fully grown, faded) until it starts.
  const ping = useSharedValue(1);
  useEffect(() => {
    ring.value = withDelay(PING_DELAY_MS, withTiming(1, { duration: RING_IN_MS, reduceMotion: ReduceMotion.System }), ReduceMotion.System);
    const once = withSequence(withTiming(0, { duration: 0 }), withTiming(1, { duration: PING_MS, easing: Easing.out(Easing.quad) }));
    ping.value = withDelay(PING_DELAY_MS, withRepeat(once, -1, false), ReduceMotion.System);
    return () => {
      cancelAnimation(ring);
      cancelAnimation(ping);
    };
  }, [ring, ping]);
  const pingStyle = useAnimatedStyle(() => ({ opacity: 0.8 * (1 - ping.value), transform: [{ scale: PING_FROM + (PING_TO - PING_FROM) * ping.value }] }));
  const secondKm = FIRST_DISTANCE_KM * (Math.hypot(at.hostile.x - at.support.x, at.hostile.y - at.support.y) / Math.hypot(at.hostile.x - at.friendly.x, at.hostile.y - at.friendly.y));
  const center = (p: Pt, w: number, h: number) => ({ position: 'absolute' as const, left: p.x - w / 2, top: p.y - h / 2 });

  const unit = (p: Pt, sidc: string, name: string, color: string, beside = false) => (
    <View style={center(p, symbol.width, symbol.height)}>
      <SymbolImage sidc={sidc} {...symbol} />
      <Text
        numberOfLines={1}
        style={[{ color, position: 'absolute', width: 80 }, beside ? { left: symbol.width - 4, top: symbol.height - 2 } : { left: (symbol.width - 80) / 2, top: symbol.height + 2, textAlign: 'center' }]}
        className="font-mono-bold text-xs tracking-wider">
        {name}
      </Text>
    </View>
  );

  return (
    <View
      testID="landing-scene"
      pointerEvents="none"
      className="flex-1"
      style={{ minHeight }}
      onLayout={(e) => {
        const { x, y, width, height } = e.nativeEvent.layout;
        setBox({ width, height });
        onFrame({ x, y, width, height });
      }}>
      {box.width > 0 ? (
        <>
          <Canvas style={{ position: 'absolute', top: 0, left: 0, width: box.width, height: box.height }}>
            <Group opacity={ring}>
              <Path path={circlePath(at.hostile, ringRadius)} color={colors.hostile} opacity={0.1} />
              <Path path={circlePath(at.hostile, ringRadius)} style="stroke" strokeWidth={1.5} color={colors.accent}>
                <DashPathEffect intervals={[6, 5]} />
              </Path>
            </Group>
            <Path path={`M${at.friendly.x} ${at.friendly.y} L${at.support.x} ${at.support.y}`} style="stroke" strokeWidth={2} color={colors.friendly} end={report.end}>
              <DashPathEffect intervals={[4, 6]} />
            </Path>
            {[
              { from: at.friendly, end: first.end },
              { from: at.support, end: second.end },
            ].map(({ from, end }) => (
              <Path key={`${from.x},${from.y}`} path={`M${from.x} ${from.y} L${at.hostile.x} ${at.hostile.y}`} style="stroke" strokeWidth={3} color={colors.accent} end={end}>
                <DashPathEffect intervals={[8, 6]} />
              </Path>
            ))}
          </Canvas>
          <Animated.View
            testID="landing-ping"
            style={[center(at.hostile, 2 * ringRadius, 2 * ringRadius), { width: 2 * ringRadius, height: 2 * ringRadius, borderRadius: ringRadius, borderWidth: 1, borderColor: colors.hostile }, pingStyle]}
          />
          {unit(at.friendly, composeSidc('friend', 'infantry', 'platoon'), 'ALPHA-1', colors.friendly)}
          {unit(at.support, composeSidc('friend', 'recon', 'section'), 'BRAVO-2', colors.friendly)}
          {unit(at.hostile, composeSidc('hostile', 'armor', 'company'), 'HOS-1', colors.hostile, true)}
          <MeasureLabel testID="landing-measure-label" at={at.label} km={FIRST_DISTANCE_KM} bearingDeg={screenBearingDeg(at.friendly, at.hostile)} shown={first.label} />
          <MeasureLabel testID="landing-measure-label-2" at={at.supportLabel} km={secondKm} bearingDeg={screenBearingDeg(at.support, at.hostile)} shown={second.label} />
        </>
      ) : null}
    </View>
  );
}

/** A measure line drawing itself in after `delayMs` (`end`, 0 → 1), then its label fading in (`label`, 0 → 1). */
function useMeasureIn(delayMs: number) {
  const end = useSharedValue(0);
  const label = useSharedValue(0);
  useEffect(() => {
    end.value = withDelay(delayMs, withTiming(1, { duration: LINE_MS, reduceMotion: ReduceMotion.System }), ReduceMotion.System);
    label.value = withDelay(delayMs + LINE_MS, withTiming(1, { duration: LABEL_MS, reduceMotion: ReduceMotion.System }), ReduceMotion.System);
  }, [end, label, delayMs]);
  return { end, label };
}

/**
 * Like the map's measure label, written by the same formatters (mils always four digits): the distance in its value
 * color, then the bearing, the line passing behind.
 */
function MeasureLabel({ testID, at, km, bearingDeg, shown }: { testID: string; at: Pt; km: number; bearingDeg: number; shown: SharedValue<number> }) {
  const style = useAnimatedStyle(() => ({ opacity: shown.value }));
  return (
    <Animated.View testID={testID} style={[{ position: 'absolute', left: at.x, top: at.y, transform: [{ translateX: '-50%' }, { translateY: '-50%' }] }, style]} className="rounded-lg border border-border bg-surface-sunken px-3 py-1.5">
      <Text numberOfLines={1} className="font-mono text-sm text-text">
        <Text className="font-mono-bold text-value-distance">{formatDistance(km * 1000)}</Text>
        <Text className="text-text-muted">{' · '}</Text>
        {formatAngle(bearingDeg, 'mil')}
      </Text>
    </Animated.View>
  );
}
