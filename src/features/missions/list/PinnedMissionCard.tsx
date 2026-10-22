import { Pressable, Text, View } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { useTheme } from '@/theme/ThemeProvider';

import { formatLastOpened } from '../format';
import { mgrsSquare } from '../mission-list';
import { StatsRow } from './CategoryCounts';
import type { CardProps } from './MissionCard';
import { MissionSwipeRow } from './MissionSwipeRow';
import { MissionThumb } from './MissionThumb';

/** The last-opened mission, pinned above the list: its map picture, Resume and its stats. */
export function PinnedMissionCard({ mission, counts, now, onOpen, onRename, onDelete, onOpenActions, fill }: CardProps & { fill?: boolean }) {
  const { colors } = useTheme();
  const square = mission.camera ? mgrsSquare(mission.camera.center) : null;
  return (
    <MissionSwipeRow
      name={mission.name}
      onPress={onOpen}
      onRename={onRename}
      onDelete={onDelete}
      onOpenActions={onOpenActions}
      fill={fill}
      className="overflow-hidden rounded-2xl border border-accent bg-surface-raised">
      <MissionThumb
        missionId={mission.id}
        snapshot={mission.snapshot}
        className={fill ? 'flex-1' : 'w-full'}
        style={fill ? undefined : { aspectRatio: 2.5 }}
        iconSize={32}>
        <View className="absolute left-3 top-3 flex-row items-center gap-1.5 rounded-full bg-surface-chrome px-3 py-1">
          <View className="h-2 w-2 rounded-full bg-accent" />
          <Text className="text-xs font-bold uppercase tracking-widest text-accent">Last opened</Text>
        </View>
        {square ? (
          <View className="absolute right-3 top-3 rounded-full bg-surface-chrome px-3 py-1">
            <Text className="font-mono text-xs text-text">{square}</Text>
          </View>
        ) : null}
      </MissionThumb>
      <View className="gap-3 p-4">
        <View className="flex-row items-center gap-3">
          <View className="flex-1">
            <Text numberOfLines={1} className="text-2xl font-bold text-text">
              {mission.name}
            </Text>
            <Text className="text-sm text-text-muted">{formatLastOpened(mission.lastOpenedAt, now)}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Resume ${mission.name}`}
            onPress={onOpen}
            className="flex-row items-center gap-1 rounded-xl bg-accent px-4 py-2.5 active:opacity-60">
            <Text className="text-base font-bold text-on-accent">Resume</Text>
            <Icon name="chevron-right" size={20} color={colors['on-accent']} />
          </Pressable>
        </View>
        <View className="h-px bg-border" />
        <StatsRow counts={counts} />
      </View>
    </MissionSwipeRow>
  );
}
