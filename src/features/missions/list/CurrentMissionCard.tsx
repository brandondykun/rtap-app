import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { map } from 'rxjs';

import { Icon } from '@/components/ui/Icon';
import { useObservable } from '@/hooks/use-observable';
import { useCommandContext } from '@/lib/db/command-context-provider';
import { useInteraction } from '@/stores/interaction';
import { useTheme } from '@/theme/ThemeProvider';

import { formatLastSaved } from '../format';
import { mgrsSquare, NO_COUNTS } from '../mission-list';
import { observeMissionCategoryCounts, observeMissionLastChange, observeMissionSummaries } from '../repository';
import { CountsRow } from './CategoryCounts';
import { MissionThumb } from './MissionThumb';

/** How often "Saved 2 min ago" is brought up to date while the card is shown. */
const NOW_TICK_MS = 30_000;

/**
 * The open mission, at the top of the main menu: its map picture (from when it was last left), name, counts, when it
 * last changed and the 100 km square under the crosshair, and Switch mission.
 */
export function CurrentMissionCard({ missionId, onSwitch }: { missionId: string; onSwitch: () => void }) {
  const ctx = useCommandContext();
  const { colors } = useTheme();
  const mission = useObservable(() => observeMissionSummaries(ctx.db).pipe(map((list) => list.find((m) => m.id === missionId) ?? null)), null, [ctx, missionId]);
  const counts = useObservable(() => observeMissionCategoryCounts(ctx.db, missionId), NO_COUNTS, [ctx, missionId]);
  const lastChange = useObservable(() => observeMissionLastChange(ctx.db, missionId), null, [ctx, missionId]);
  // Re-renders only when the square changes, not on every camera frame.
  const square = useInteraction((s) => (s.cameraCenter ? mgrsSquare(s.cameraCenter) : null));
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), NOW_TICK_MS);
    return () => clearInterval(timer);
  }, []);
  const saved = [lastChange === null ? null : formatLastSaved(lastChange, now), square].filter(Boolean).join(' · ');

  return (
    <View
      testID="current-mission-card"
      style={{
        borderLeftWidth: 4,
        borderLeftColor: colors.accent,
        // A warm wash from the amber edge, fading into the card's darker fill.
        experimental_backgroundImage: `linear-gradient(to bottom right, ${colors['accent-subtle']}, ${colors['surface-sunken']} 70%)`,
      }}
      className="gap-4 overflow-hidden rounded-2xl border border-border bg-surface-sunken p-4">
      <View className="flex-row items-center gap-4">
        <MissionThumb missionId={missionId} snapshot={mission?.snapshot ?? null} className="h-20 w-20 rounded-xl border border-border" iconSize={24} />
        <View className="flex-1 gap-0.5">
          <Text className="text-xs font-bold uppercase tracking-widest text-accent">Current mission</Text>
          <Text testID="current-mission-name" numberOfLines={1} className="text-2xl font-bold text-text">
            {mission?.name ?? ''}
          </Text>
          <CountsRow counts={counts} />
          {saved ? (
            <Text testID="current-mission-saved" numberOfLines={1} className="text-sm text-text-muted">
              {saved}
            </Text>
          ) : null}
        </View>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Switch mission"
        onPress={onSwitch}
        className="flex-row items-center justify-center gap-3 rounded-xl border border-border bg-surface-raised py-3 active:opacity-60">
        <Icon name="swap-horizontal" size={22} color={colors.accent} />
        <Text className="text-lg font-bold text-text">Switch mission</Text>
      </Pressable>
    </View>
  );
}
