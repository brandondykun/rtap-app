import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { getMapboxToken } from '@/config/env';
import { openMission, type OpenMissionResult } from '@/features/missions/open-mission';
import { useCommandContext } from '@/lib/db/command-context-provider';

import { MissingTokenScreen } from './MissingTokenScreen';
import { MissionMap } from './MissionMap';

/** Loads the mission before the map mounts; unknown or deleted missions return to the list. */
export function MapScreen({ missionId }: { missionId: string }) {
  const ctx = useCommandContext();
  const router = useRouter();
  const [opened, setOpened] = useState<OpenMissionResult | null>(null);

  useEffect(() => {
    let live = true;
    void openMission(ctx, missionId).then((result) => {
      if (live) setOpened(result);
    });
    return () => {
      live = false;
    };
  }, [ctx, missionId]);

  useEffect(() => {
    if (opened?.status === 'missing') router.replace('/');
  }, [opened, router]);

  if (!getMapboxToken()) return <MissingTokenScreen onBack={() => router.replace('/')} />;
  if (opened === null || opened.status === 'missing') return <View className="flex-1 bg-surface" />;
  return <MissionMap missionId={missionId} savedCamera={opened.camera} />;
}
