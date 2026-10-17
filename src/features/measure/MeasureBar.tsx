import { MenuButton } from '@/components/menu/MenuButton';
import { CrosshairGlyph } from '@/components/ui/CrosshairGlyph';
import { MapHintBar } from '@/features/map/controls/MapHintBar';
import { useInteraction } from '@/stores/interaction';
import { useMeasure } from '@/stores/measure';
import { useSettings } from '@/stores/settings';
import { useTheme } from '@/theme/ThemeProvider';

import { measureReadout } from './measure-readout';

/** While measuring, in place of your grid card: what to set next (or the readout), Set at crosshair and Stop. */
export function MeasureBar() {
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

  // Icon-only buttons leave the readout room on a narrow phone.
  return (
    <MapHintBar testID="measure-bar" hint={readout} mono={!!(start && end)}>
      <MenuButton compact iconOnly label="Set at crosshair" icon={<CrosshairGlyph size={16} color={colors.text} />} onPress={setAtCrosshair} />
      <MenuButton compact iconOnly label="Stop measuring" icon="close" onPress={() => useMeasure.getState().stopMeasure()} />
    </MapHintBar>
  );
}
