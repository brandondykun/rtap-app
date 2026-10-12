import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useObservable } from '@/hooks/use-observable';
import { useCommandContext } from '@/lib/db/command-context-provider';

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

  return (
    <View
      className="flex-1 bg-surface"
      style={{ paddingTop: insets.top, paddingLeft: insets.left, paddingRight: insets.right }}>
      <View className="flex-row items-center justify-between px-4 pb-3 pt-4">
        <Text className="text-lg font-semibold uppercase tracking-widest text-text">Missions</Text>
        {missions && missions.length > 0 ? (
          <Pressable accessibilityRole="button" onPress={openCreate} className="rounded-xl bg-accent px-4 py-2">
            <Text className="font-bold text-on-accent">+ New</Text>
          </Pressable>
        ) : null}
      </View>
      {missions === null ? null : missions.length === 0 ? (
        <EmptyState onCreate={openCreate} />
      ) : (
        <FlatList
          data={missions}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 16, gap: 8 }}
          renderItem={({ item }) => <MissionRow mission={item} now={now} onPress={() => openMission(item.id)} />}
        />
      )}
    </View>
  );
}

function MissionRow({ mission, now, onPress }: { mission: MissionSummary; now: number; onPress: () => void }) {
  const ctx = useCommandContext();
  const count = useObservable(() => observeMissionItemCount(ctx.db, mission.id), 0, [ctx, mission.id]);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${mission.name}`}
      onPress={onPress}
      className="rounded-2xl border border-border bg-surface-raised px-4 py-3 active:opacity-80">
      <Text numberOfLines={1} className="text-base font-semibold text-text">
        {mission.name}
      </Text>
      <Text className="mt-1 text-sm text-text-muted">
        {`${formatItemCount(count)} · ${formatLastOpened(mission.lastOpenedAt, now)}`}
      </Text>
    </Pressable>
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
