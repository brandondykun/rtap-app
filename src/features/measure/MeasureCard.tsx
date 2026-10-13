import { Pressable, Text, View } from 'react-native';

import { MenuButton } from '@/components/menu/MenuButton';
import { CrosshairGlyph } from '@/components/ui/CrosshairGlyph';
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

  return (
    <View testID="measure-card" className="gap-2 self-start rounded-2xl border border-accent bg-surface-chrome p-3">
      <Text className="text-xs font-bold uppercase tracking-widest text-accent">Measure</Text>
      <Text className="font-mono text-2xl font-semibold text-text">{readout}</Text>
      <View className="flex-row items-center gap-2">
        <MenuButton label="From me" icon="crosshairs-gps" onPress={() => self && useMeasure.getState().setFromMe(self)} disabled={!self} />
        <MenuButton label="Restart" icon="restore" iconOnly onPress={() => useMeasure.getState().restart()} disabled={!start} />
        <MenuButton label="Stop measuring" icon="close" iconOnly onPress={() => useMeasure.getState().stopMeasure()} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Set at crosshair"
          onPress={setAtCrosshair}
          className="h-12 w-14 items-center justify-center rounded-xl bg-accent">
          <CrosshairGlyph size={22} color={colors['on-accent']} />
        </Pressable>
      </View>
    </View>
  );
}
