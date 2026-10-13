import { Pressable, Text, View } from 'react-native';

import { CrosshairGlyph } from '@/components/ui/CrosshairGlyph';
import { MapButton } from '@/features/map/controls/MapButton';
import { useInteraction } from '@/stores/interaction';
import { useMeasure } from '@/stores/measure';
import { usePresence } from '@/stores/presence';
import { useSettings } from '@/stores/settings';
import { useTheme } from '@/theme/ThemeProvider';

import { measureReadout } from './measure-readout';

/** Top-left while measuring: the readout, From me, Restart, Stop (×) and the amber Set. */
export function MeasureCard() {
  const { colors } = useTheme();
  const start = useMeasure((s) => s.start);
  const end = useMeasure((s) => s.end);
  const center = useInteraction((s) => s.cameraCenter);
  const self = usePresence((s) => s.selfPosition?.position ?? null);
  const angleUnit = useSettings((s) => s.angleUnit);
  const northRef = useSettings((s) => s.northRef);
  const declinationOverrideDeg = useSettings((s) => s.declinationOverrideDeg);
  const to = end ?? center;
  const readout = start && to ? measureReadout(start, to, { angleUnit, northRef, declinationOverrideDeg }) : 'Set start';

  const setAtCrosshair = () => {
    const c = useInteraction.getState().cameraCenter;
    if (c) useMeasure.getState().place(c);
  };

  // Compact: the readout with Stop beside it, then From me / Restart and the amber Set.
  return (
    <View testID="measure-card" className="gap-1 self-start rounded-2xl border border-accent bg-surface-chrome px-2 py-1">
      <View className="flex-row items-center gap-1">
        <Text className="pl-1 font-mono text-lg font-semibold text-text">{readout}</Text>
        <View className="ml-auto">
          <MapButton grouped label="Stop measuring" icon="close" onPress={() => useMeasure.getState().stopMeasure()} />
        </View>
      </View>
      <View testID="measure-buttons" className="flex-row items-center gap-1" style={{ flexWrap: 'wrap' }}>
        <MapButton grouped label="From me" icon="crosshairs-gps" onPress={() => self && useMeasure.getState().setFromMe(self)} disabled={!self} />
        <MapButton grouped label="Restart" icon="restore" onPress={() => useMeasure.getState().restart()} disabled={!start} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Set at crosshair"
          onPress={setAtCrosshair}
          className="ml-auto h-10 w-12 items-center justify-center rounded-xl bg-accent">
          <CrosshairGlyph size={20} color={colors['on-accent']} />
        </Pressable>
      </View>
    </View>
  );
}
