import { useLocalSearchParams } from 'expo-router';

import { RenameMissionScreen } from '@/features/missions/RenameMissionScreen';

export default function RenameMissionRoute() {
  const { missionId } = useLocalSearchParams<{ missionId: string }>();
  return <RenameMissionScreen missionId={missionId} />;
}
