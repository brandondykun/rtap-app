import { Redirect } from 'expo-router';

import { MissionsScreen } from '@/features/missions/MissionsScreen';
import { useProfile } from '@/stores/profile';

export default function MissionsRoute() {
  // First launch: the landing screen, until Get started.
  const landingSeen = useProfile((s) => s.landingSeen);
  if (!landingSeen) return <Redirect href="/welcome" />;
  return <MissionsScreen />;
}
