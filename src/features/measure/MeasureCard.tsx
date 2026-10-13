import { Pressable, Text, View } from 'react-native';

import { CrosshairGlyph } from '@/components/ui/CrosshairGlyph';
import { MapButton } from '@/features/map/controls/MapButton';
import { useInteraction } from '@/stores/interaction';
import { useMeasure } from '@/stores/measure';
import { useSettings } from '@/stores/settings';
import { useTheme } from '@/theme/ThemeProvider';

import { measureReadout } from './measure-readout';

/** Top-left while measuring, on one line: the readout, Restart, Stop (×) and the amber Set. */
export function MeasureCard() {
  const { colors } = useTheme();
  const start = useMeasure((s) => s.start);
  const end = useMeasure((s) => s.end);
  const angleUnit = useSettings((s) => s.angleUnit);
  const northRef = useSettings((s) => s.northRef);
  const declinationOverrideDeg = useSettings((s) => s.declinationOverrideDeg);
  const readout = !start ? 'Set start' : !end ? 'Set end' : measureReadout(start, end, { angleUnit, northRef, declinationOverrideDeg });

  const setAtCrosshair = () => {
    const c = useInteraction.getState().cameraCenter;
    if (c) useMeasure.getState().place(c);
  };

  // One line: title over the readout (shrinks to fit), then Restart, Stop and the amber Set.
  return (
    <View testID="measure-card" className="self-start rounded-2xl border border-accent bg-surface-chrome px-2 py-1">
      <View testID="measure-row" className="flex-row items-center gap-1" style={{ flexDirection: 'row' }}>
        <View className="shrink pl-1 pr-1">
          <Text className="text-[10px] font-bold uppercase tracking-widest text-accent">Measure</Text>
          <Text numberOfLines={1} adjustsFontSizeToFit className="font-mono text-lg font-semibold text-text">
            {readout}
          </Text>
        </View>
        <MapButton grouped label="Restart" icon="restore" onPress={() => useMeasure.getState().restart()} disabled={!start} />
        <MapButton grouped label="Stop measuring" icon="close" onPress={() => useMeasure.getState().stopMeasure()} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Set at crosshair"
          onPress={setAtCrosshair}
          className="h-10 w-12 items-center justify-center rounded-xl bg-accent">
          <CrosshairGlyph size={20} color={colors['on-accent']} />
        </Pressable>
      </View>
    </View>
  );
}
