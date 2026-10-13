import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import ReanimatedSwipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { PERF_SEED_COUNT, seedPerformanceMission } from '@/features/dev/commands';
import { notifySuccess } from '@/features/feedback/feedback';
import { useObservable } from '@/hooks/use-observable';
import { useCommandContext } from '@/lib/db/command-context-provider';

import { deleteMission } from './commands';
import { formatItemCount, formatLastOpened } from './format';
import { observeMissionItemCount, observeMissionSummaries, type MissionSummary } from './repository';

export function MissionsScreen() {
  const ctx = useCommandContext();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const missions = useObservable<MissionSummary[] | null>(() => observeMissionSummaries(ctx.db), null, [ctx]);
  const [now, setNow] = useState(Date.now);
  useFocusEffect(
    useCallback(() => {
      setNow(Date.now());
    }, []),
  );

  const openCreate = () => router.push('/missions/new');
  const openMission = (missionId: string) =>
    router.push({ pathname: '/missions/[missionId]', params: { missionId } });

  // Swipe-to-delete: one row open at a time, and every delete goes through the confirmation.
  const openRow = useRef<SwipeableMethods | null>(null);
  const [pending, setPending] = useState<{ id: string; name: string; count: number } | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const deleting = useRef(false);
  const rowOpened = (row: SwipeableMethods) => {
    if (openRow.current && openRow.current !== row) openRow.current.close();
    openRow.current = row;
  };
  const askDelete = (mission: MissionSummary, count: number) => {
    openRow.current?.close();
    setDeleteError(null);
    setPending({ id: mission.id, name: mission.name, count });
  };
  const confirmDelete = async () => {
    if (!pending || deleting.current) return;
    deleting.current = true;
    const result = await deleteMission(ctx, pending.id);
    deleting.current = false;
    if (result.ok) notifySuccess();
    if (result.ok || result.error === 'not_found') setPending(null);
    else setDeleteError('Could not delete the mission. Try again.');
  };

  const seeding = useRef(false);
  const seed = async () => {
    if (seeding.current) return;
    seeding.current = true;
    const result = await seedPerformanceMission(ctx, { count: PERF_SEED_COUNT });
    seeding.current = false;
    if (result.ok) openMission(result.value.missionId);
  };

  return (
    <View
      className="flex-1 bg-surface"
      style={{ paddingTop: insets.top, paddingLeft: insets.left, paddingRight: insets.right }}>
      <View className="flex-row items-center justify-between px-4 pb-3 pt-4">
        <Text className="text-lg font-semibold uppercase tracking-widest text-text">Missions</Text>
        <View className="flex-row items-center gap-3">
          {__DEV__ ? (
            <Pressable accessibilityRole="button" onPress={() => void seed()} hitSlop={8}>
              <Text className="text-xs uppercase tracking-wider text-text-muted">Seed 5k</Text>
            </Pressable>
          ) : null}
          {missions && missions.length > 0 ? (
            <Pressable accessibilityRole="button" onPress={openCreate} className="rounded-xl bg-accent px-4 py-2">
              <Text className="font-bold text-on-accent">+ New</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
      {missions === null ? null : missions.length === 0 ? (
        <EmptyState onCreate={openCreate} />
      ) : (
        <FlatList
          data={missions}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 16, gap: 8 }}
          renderItem={({ item }) => (
            <MissionRow
              mission={item}
              now={now}
              onPress={() => openMission(item.id)}
              onDelete={(count) => askDelete(item, count)}
              onOpenActions={rowOpened}
            />
          )}
        />
      )}
      <ConfirmDialog
        visible={pending !== null}
        title="Delete mission?"
        message={pending ? `Delete ${pending.name} and its ${formatItemCount(pending.count)}? This can't be undone.` : ''}
        confirmLabel="Delete"
        onConfirm={() => void confirmDelete()}
        onCancel={() => setPending(null)}
        error={deleteError}
      />
    </View>
  );
}

type MissionRowProps = {
  mission: MissionSummary;
  now: number;
  onPress: () => void;
  onDelete: (count: number) => void;
  onOpenActions: (row: SwipeableMethods) => void;
};

function MissionRow({ mission, now, onPress, onDelete, onOpenActions }: MissionRowProps) {
  const ctx = useCommandContext();
  const count = useObservable(() => observeMissionItemCount(ctx.db, mission.id), 0, [ctx, mission.id]);
  const row = useRef<SwipeableMethods>(null);
  return (
    <ReanimatedSwipeable
      ref={row}
      friction={2}
      rightThreshold={40}
      overshootRight={false}
      onSwipeableWillOpen={() => {
        if (row.current) onOpenActions(row.current);
      }}
      renderRightActions={() => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Delete ${mission.name}`}
          onPress={() => onDelete(count)}
          className="ml-2 w-24 items-center justify-center rounded-2xl bg-danger active:opacity-60">
          <Text className="font-bold text-text">Delete</Text>
        </Pressable>
      )}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open ${mission.name}`}
        // Swiping is hard to find with VoiceOver, so Delete is also an accessibility action.
        accessibilityActions={[{ name: 'delete', label: 'Delete' }]}
        onAccessibilityAction={(e) => {
          if (e.nativeEvent.actionName === 'delete') onDelete(count);
        }}
        onPress={onPress}
        className="rounded-2xl border border-border bg-surface-raised px-4 py-3 active:opacity-80">
        <Text numberOfLines={1} className="text-base font-semibold text-text">
          {mission.name}
        </Text>
        <Text className="mt-1 text-sm text-text-muted">
          {`${formatItemCount(count)} · ${formatLastOpened(mission.lastOpenedAt, now)}`}
        </Text>
      </Pressable>
    </ReanimatedSwipeable>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <View className="flex-1 items-center justify-center gap-3 px-8">
      <Text className="text-lg font-semibold text-text">No missions yet</Text>
      <Text className="text-center text-sm text-text-muted">
        A mission is a map for one operation or training day. Create one to start placing points.
      </Text>
      <Pressable accessibilityRole="button" onPress={onCreate} className="mt-2 rounded-xl bg-accent px-6 py-3">
        <Text className="font-bold text-on-accent">Create mission</Text>
      </Pressable>
    </View>
  );
}
