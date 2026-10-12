import { useLocalSearchParams } from 'expo-router';

import { MapScreen } from '@/features/map/MapScreen';

export default function MissionMapRoute() {
  const { missionId } = useLocalSearchParams<{ missionId: string }>();
  return <MapScreen key={missionId} missionId={missionId} />;
}
