import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { cancelAnimation, ReduceMotion, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { Icon, type IconName } from '@/components/ui/Icon';
import { clusterStats } from '@/features/location/gps-average-math';
import { inverse } from '@/lib/geo/measure/geodesic';
import { formatDistance } from '@/lib/geo/format/measure';
import { useGpsAverage } from '@/stores/gps-average';
import { useTheme } from '@/theme/ThemeProvider';

/** One slow fade out and back: a calm "still working", not an alarm. */
const BLINK_MS = 1000;

/** 0:42, 12:05, then whole hours (1hr+, 2hr+) so a long average never widens the header. */
export function formatElapsed(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  if (h > 0) return `${h}hr+`;
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/**
 * How long averaging has run, as a stopwatch: from the AVG tap, stopped while paused, carried on by Resume. It ticks on
 * the stopwatch's own whole seconds, so the display never lags real time.
 */
export function useAverageStopwatchMs(): number {
  const elapsedMs = useGpsAverage((s) => s.elapsedMs);
  const runningSince = useGpsAverage((s) => s.runningSince);
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    if (runningSince === null) return;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const t = Date.now();
      setNow(t);
      timer = setTimeout(tick, 1000 - ((t - runningSince) % 1000));
    };
    timer = setTimeout(tick, 0);
    return () => clearTimeout(timer);
  }, [runningSince]);
  return elapsedMs + (runningSince !== null && now !== null ? Math.max(0, now - runningSince) : 0);
}

/** 999, then 1K, 1.1K … 9.9K, then 10K+, 11K+, so a long average never widens the header. Rounds down: never overstates. */
export function formatFixCount(n: number): string {
  if (n < 1000) return String(n);
  if (n < 10_000) return `${Math.floor(n / 100) / 10}K`;
  return `${Math.floor(n / 1000)}K+`;
}

const fixes = (n: number) => (n === 1 ? '1 fix' : `${formatFixCount(n)} fixes`);

function BlinkingDot({ color }: { color: string }) {
  const opacity = useSharedValue(1);
  useEffect(() => {
    opacity.value = withRepeat(withTiming(0.2, { duration: BLINK_MS, reduceMotion: ReduceMotion.System }), -1, true);
    return () => cancelAnimation(opacity);
  }, [opacity]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <View className="h-4 w-4 items-center justify-center">
      <Animated.View testID="average-blink" style={[{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }, style]} />
    </View>
  );
}

/**
 * Average mode's status line, across the top of the grid display: averaging (time spent and fixes so far) or paused
 * (how far the user is from the held average). It spans the dock's side padding; `minimal` drops the counts.
 */
export function AverageHeader({ inline, minimal = false }: { inline: boolean; minimal?: boolean }) {
  const { colors } = useTheme();
  const phase = useGpsAverage((s) => s.phase);
  const samples = useGpsAverage((s) => s.samples);
  const fixCount = useGpsAverage((s) => s.fixCount);
  const live = useGpsAverage((s) => s.live);
  const pausedAt = useGpsAverage((s) => s.pausedAt);
  const showFixes = useGpsAverage((s) => s.showFixes);
  const stats = useMemo(() => clusterStats(samples), [samples]);
  const elapsedMs = useAverageStopwatchMs();
  if (phase === 'off') return null;

  // Only a fix since the pause says where the user is now.
  const fresh = live !== null && (pausedAt === null || live.timestamp > pausedAt);
  const fromAverage = phase === 'paused' && fresh && stats ? formatDistance(inverse(live.position, stats.center.position).distanceM) : null;
  const distance = (text: string) => (
    <Text testID="average-distance" style={{ color: colors['value-distance'] }} className="font-mono">
      {text}
    </Text>
  );

  let title: string;
  let lead: ReactNode;
  let note: ReactNode;
  let detail: string;
  if (phase === 'averaging') {
    title = 'AVERAGE MODE';
    lead = <BlinkingDot color={colors.averaged} />;
    note = 'hold still';
    detail = `${formatElapsed(elapsedMs / 1000)} · ${fixes(fixCount)}`;
  } else {
    title = 'PAUSED';
    lead = <Icon name="pause-circle" size={16} color={colors.averaged} />;
    note = fromAverage ? <>you moved {distance(fromAverage)}</> : 'you moved';
    detail = `${fixes(fixCount)} kept`;
  }

  return (
    <View testID="average-header" className={`flex-row items-center bg-averaged-subtle ${inline ? '-mx-2 px-2 py-1.5' : '-mx-3 px-3 py-2'}`}>
      <View accessible accessibilityRole="header" className="shrink flex-row items-center gap-2">
        {lead}
        <Text numberOfLines={1} className="shrink text-sm text-text">
          <Text style={{ color: colors.averaged }} className="font-mono-bold text-xs tracking-wide">
            {title}
          </Text>
          {' · '}
          {note}
        </Text>
      </View>
      {minimal ? null : (
        // The fix count switches the fixes on the map; the eye says which way.
        <Pressable
          testID="average-fixes-toggle"
          accessibilityRole="button"
          accessibilityLabel={`${showFixes ? 'Hide' : 'Show'} fixes on map, ${detail}`}
          accessibilityState={{ selected: showFixes }}
          hitSlop={8}
          onPress={() => useGpsAverage.getState().toggleFixes()}
          className="ml-auto flex-row items-center gap-1.5 pl-2 active:opacity-60">
          <Icon name={showFixes ? 'eye-outline' : 'eye-off-outline'} size={12} color={showFixes ? colors.averaged : colors['text-muted']} />
          <Text testID="average-detail" numberOfLines={1} className="font-mono text-xs text-text-muted">
            {detail}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

function ActionButton({ label, text = label, icon, primary = false, inline, onPress }: { label: string; text?: string; icon: IconName; primary?: boolean; inline: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      className={`flex-1 flex-row items-center justify-center gap-2 active:opacity-60 ${inline ? 'h-9 rounded-md' : 'h-11 rounded-lg'} ${primary ? 'bg-averaged' : 'border border-border bg-surface-raised'}`}>
      <Icon name={icon} size={18} color={colors.text} />
      <Text numberOfLines={1} className="text-base font-semibold text-text">
        {text}
      </Text>
    </Pressable>
  );
}

/**
 * Below the grids while paused: what to do next. Averaging stays paused until answered. Resume always carries on: the
 * pause may be the GPS wandering, and the user knows better whether they moved.
 */
export function AverageActions({ inline }: { inline: boolean }) {
  const paused = useGpsAverage((s) => s.phase === 'paused');
  if (!paused) return null;
  return (
    <View testID="average-actions" className={`flex-row gap-2 ${inline ? 'pb-2 pt-1' : 'pb-3 pt-1'}`}>
      <ActionButton primary inline={inline} label="Resume" icon="play" onPress={() => useGpsAverage.getState().resume()} />
      <ActionButton inline={inline} label="Discard" icon="close" onPress={() => useGpsAverage.getState().stop()} />
    </View>
  );
}
