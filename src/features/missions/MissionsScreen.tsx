import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, Text, useWindowDimensions, View } from 'react-native';
import type { SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Icon } from '@/components/ui/Icon';
import { PERF_SEED_COUNT, seedPerformanceMission } from '@/features/dev/commands';
import { notifySuccess } from '@/features/feedback/feedback';
import { isLandscape } from '@/features/map/layout';
import { useObservable } from '@/hooks/use-observable';
import { useCommandContext } from '@/lib/db/command-context-provider';
import { useProfile } from '@/stores/profile';
import { useSettings } from '@/stores/settings';
import { useTheme } from '@/theme/ThemeProvider';

import { deleteMission } from './commands';
import { formatCategoryCounts } from './format';
import { MissionCard } from './list/MissionCard';
import { MissionsHeader } from './list/MissionsHeader';
import { PinnedMissionCard } from './list/PinnedMissionCard';
import { filterMissions, formatMissionTotals, NO_COUNTS, pinnedMission, sortHeading, sortMissions } from './mission-list';
import { observeCountsByMission, observeMissionSummaries, type CategoryCounts, type MissionSummary } from './repository';

const NO_COUNT_MAP: ReadonlyMap<string, CategoryCounts> = new Map();

export function MissionsScreen() {
  const ctx = useCommandContext();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const landscape = isLandscape(width, height);

  // First launch: ask for a callsign once (the sheet marks it answered as it opens).
  useEffect(() => {
    if (!useProfile.getState().callsignPrompted) router.push('/callsign');
  }, [router]);
  const missions = useObservable<MissionSummary[] | null>(() => observeMissionSummaries(ctx.db), null, [ctx]);
  const idsKey = (missions ?? []).map((m) => m.id).join(',');
  const counts = useObservable(() => observeCountsByMission(ctx.db, idsKey ? idsKey.split(',') : []), NO_COUNT_MAP, [ctx, idsKey]);
  const countsOf = (id: string) => counts.get(id) ?? NO_COUNTS;
  const sort = useSettings((s) => s.missionSort);
  const setSort = useSettings((s) => s.setMissionSort);
  const [query, setQuery] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now);
  useFocusEffect(
    useCallback(() => {
      setNow(Date.now());
    }, []),
  );

  const openCreate = () => router.push('/missions/new');
  const openMission = (missionId: string) => router.push({ pathname: '/missions/[missionId]', params: { missionId } });

  // Swipe-to-delete: one row open at a time, and every delete goes through the confirmation.
  const openRow = useRef<SwipeableMethods | null>(null);
  const [pending, setPending] = useState<{ id: string; name: string; counts: CategoryCounts } | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const deleting = useRef(false);
  const rowOpened = useCallback(
    (row: SwipeableMethods) => {
      if (openRow.current && openRow.current !== row) openRow.current.close();
      openRow.current = row;
    },
    [openRow],
  );
  const openRename = useCallback(
    (missionId: string) => {
      openRow.current?.close();
      router.push({ pathname: '/missions/rename/[missionId]', params: { missionId } });
    },
    [router],
  );
  const askDelete = useCallback(
    (mission: MissionSummary, counts: CategoryCounts) => {
      openRow.current?.close();
      setDeleteError(null);
      setPending({ id: mission.id, name: mission.name, counts });
    },
    [openRow],
  );
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

  const all = missions ?? [];
  const pinned = query === null ? pinnedMission(all) : null;
  const listed = sortMissions(filterMissions(all, query ?? ''), sort, counts).filter((m) => m.id !== pinned?.id);
  const units = all.reduce((n, m) => n + countsOf(m.id).units, 0);
  const heading = query === null && listed.length > 0 ? sortHeading(sort) : null;
  const cardProps = (m: MissionSummary) => ({
    mission: m,
    counts: countsOf(m.id),
    now,
    onOpen: () => openMission(m.id),
    onRename: () => openRename(m.id),
    onDelete: () => askDelete(m, countsOf(m.id)),
    onOpenActions: rowOpened,
  });

  const list = (
    <FlatList
      data={listed}
      keyExtractor={(m) => m.id}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={
        <>
          {!landscape && pinned ? (
            <View className="mb-3">
              <PinnedMissionCard {...cardProps(pinned)} />
            </View>
          ) : null}
          {heading ? <Text className="mt-2 text-sm font-bold tracking-widest text-text-muted">{heading}</Text> : null}
        </>
      }
      ListEmptyComponent={
        query?.trim() ? <Text className="py-8 text-center text-base text-text-muted">{`No missions match “${query.trim()}”`}</Text> : null
      }
      ListFooterComponent={<SwipeHint />}
      contentContainerStyle={{ paddingHorizontal: landscape ? 0 : 16, paddingBottom: insets.bottom + 16, gap: 12 }}
      renderItem={({ item }) => <MissionCard {...cardProps(item)} />}
    />
  );

  return (
    <View className="flex-1 bg-surface" style={{ paddingTop: insets.top, paddingLeft: insets.left, paddingRight: insets.right }}>
      <MissionsHeader
        landscape={landscape}
        subtitle={formatMissionTotals(all.length, units)}
        showControls={all.length > 0}
        sort={sort}
        onSort={setSort}
        query={query}
        onQuery={setQuery}
        onNew={openCreate}
        extra={
          __DEV__ ? (
            <View className="flex-row items-center gap-4">
              <Pressable accessibilityRole="button" onPress={() => void seed()} hitSlop={8} className="active:opacity-60">
                <Text className="text-xs uppercase tracking-wider text-text-muted">Seed 5k</Text>
              </Pressable>
              {/* Shows the first-launch callsign sheet again. */}
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  useProfile.getState().resetProfile();
                  router.push('/callsign');
                }}
                hitSlop={8}
                className="active:opacity-60">
                <Text className="text-xs uppercase tracking-wider text-text-muted">Reset callsign</Text>
              </Pressable>
            </View>
          ) : null
        }
      />
      {missions === null ? null : missions.length === 0 ? (
        <EmptyState onCreate={openCreate} />
      ) : landscape ? (
        // The list scrolls to the bottom edge (its content carries the bottom inset); only the pinned
        // card keeps a margin there.
        <View testID="landscape-columns" className="flex-1 flex-row gap-4 px-4">
          {pinned ? (
            <View testID="pinned-column" className="flex-1" style={{ paddingBottom: insets.bottom + 16 }}>
              <PinnedMissionCard {...cardProps(pinned)} fill />
            </View>
          ) : null}
          <View className="flex-1">{list}</View>
        </View>
      ) : (
        list
      )}
      <ConfirmDialog
        visible={pending !== null}
        title="Delete mission?"
        message={pending ? `Delete ${pending.name} and its ${formatCategoryCounts(pending.counts, ' and ')}? This can't be undone.` : ''}
        confirmLabel="Delete"
        onConfirm={() => void confirmDelete()}
        onCancel={() => setPending(null)}
        error={deleteError}
      />
    </View>
  );
}

function SwipeHint() {
  const { colors } = useTheme();
  return (
    <View className="mt-4 flex-row items-center justify-center gap-2">
      <Icon name="chevron-left" size={18} color={colors['text-muted']} />
      <Text className="text-sm text-text-muted">Swipe a mission for edit & delete</Text>
    </View>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <View className="flex-1 items-center justify-center gap-3 px-8">
      <Text className="text-lg font-semibold text-text">No missions yet</Text>
      <Text className="text-center text-sm text-text-muted">
        A mission is a map for one operation or training day. Create one to start placing points.
      </Text>
      <Pressable accessibilityRole="button" onPress={onCreate} className="active:opacity-60 mt-2 rounded-xl bg-accent px-6 py-3">
        <Text className="font-bold text-on-accent">Create mission</Text>
      </Pressable>
    </View>
  );
}
