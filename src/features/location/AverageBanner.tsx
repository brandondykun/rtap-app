import { Text, View } from 'react-native';

import { MenuButton } from '@/components/menu/MenuButton';
import { glassHalo } from '@/components/ui/glass';
import { startAveraging } from '@/features/location/average-actions';
import { useGpsAverage } from '@/stores/gps-average';
import { usePresence } from '@/stores/presence';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * Average mode stopped averaging because the device moved (paused), or came back somewhere else (away). Asks what to
 * do; shown even while a panel is open, since averaging stays paused until answered. Positioned by MapTopLeft.
 */
export function AverageBanner({ marginTop = 0 }: { marginTop?: number }) {
  const phase = useGpsAverage((s) => s.phase);
  if (phase !== 'paused' && phase !== 'away') return null;
  return <AverageCard paused={phase === 'paused'} marginTop={marginTop} />;
}

function AverageCard({ paused, marginTop }: { paused: boolean; marginTop: number }) {
  const { colors } = useTheme();
  const halo = glassHalo(colors);
  const stop = () => useGpsAverage.getState().stop();
  return (
    <View testID="average-banner" style={{ marginTop }} className="gap-3 rounded-2xl border-2 border-averaged bg-surface px-4 py-3">
      <Text style={halo} className="text-sm font-semibold text-text">
        {paused ? 'You moved — averaging paused' : "You're not where you were averaging"}
      </Text>
      <View className="flex-row flex-wrap gap-2">
        {paused ? (
          <>
            {/* While paused the presence store holds the live fix (or none); resume ignores any fix from before the pause. */}
            <MenuButton compact label="Resume" icon="play" onPress={() => useGpsAverage.getState().resume(usePresence.getState().selfPosition)} />
            <MenuButton compact label="Discard" icon="close" onPress={stop} />
          </>
        ) : (
          <>
            {/* Starting can only be refused on the Manual source, which cannot happen mid-average: then nothing changes. */}
            <MenuButton compact label="Start new average here" icon="crosshairs-gps" onPress={() => void startAveraging()} />
            <MenuButton compact label="Turn off" icon="close" onPress={stop} />
          </>
        )}
      </View>
    </View>
  );
}
