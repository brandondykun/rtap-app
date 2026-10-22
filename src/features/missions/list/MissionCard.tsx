import { Text, View } from 'react-native';
import type { SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';

import { Icon } from '@/components/ui/Icon';
import { useTheme } from '@/theme/ThemeProvider';

import { formatLastOpened } from '../format';
import { mgrsSquare, totalItems } from '../mission-list';
import type { CategoryCounts, MissionSummary } from '../repository';
import { CountsRow } from './CategoryCounts';
import { MissionSwipeRow } from './MissionSwipeRow';
import { MissionThumb } from './MissionThumb';

export type CardProps = {
  mission: MissionSummary;
  counts: CategoryCounts;
  now: number;
  onOpen: () => void;
  onRename: () => void;
  onDelete: () => void;
  onOpenActions: (row: SwipeableMethods) => void;
};

/** A mission in the list: thumbnail, name, when it was opened and where, and its counts. */
export function MissionCard({ mission, counts, now, onOpen, onRename, onDelete, onOpenActions }: CardProps) {
  const { colors } = useTheme();
  const opened = formatLastOpened(mission.lastOpenedAt, now);
  const square = mission.lastOpenedAt !== null && mission.camera ? mgrsSquare(mission.camera.center) : null;
  return (
    <MissionSwipeRow
      name={mission.name}
      onPress={onOpen}
      onRename={onRename}
      onDelete={onDelete}
      onOpenActions={onOpenActions}
      className="flex-row items-center gap-3 rounded-2xl border border-border bg-surface-raised p-3">
      <MissionThumb missionId={mission.id} snapshot={mission.snapshot} className="h-20 w-20 rounded-xl" iconSize={24} />
      <View className="flex-1 gap-1">
        <Text numberOfLines={1} className="text-lg font-bold text-text">
          {mission.name}
        </Text>
        <Text numberOfLines={1} className="text-sm text-text-muted">
          {square ? `${opened} · ${square}` : opened}
        </Text>
        {totalItems(counts) === 0 ? <Text className="text-sm text-text-muted">Empty — nothing plotted yet</Text> : <CountsRow counts={counts} />}
      </View>
      <Icon name="chevron-right" size={24} color={colors['text-muted']} />
    </MissionSwipeRow>
  );
}
