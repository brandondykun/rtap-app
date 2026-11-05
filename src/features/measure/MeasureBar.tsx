import { CenterButton } from '@/components/menu/CenterButton';
import { MenuButton } from '@/components/menu/MenuButton';
import { MapHintBar } from '@/features/map/controls/MapHintBar';
import { useInteraction } from '@/stores/interaction';
import { useMeasure } from '@/stores/measure';

import { measureStep } from './measure-step';

/**
 * While measuring, over your grid card: what to set next, Set at CTR and Stop. Once both are set the readout is on the
 * line, and the bar asks to tap a point (either dot) to move it, with no CTR until one is picked.
 */
export function MeasureBar() {
  const step = useMeasure(measureStep);
  const hint = step === 'start' ? 'Set start' : step === 'end' ? 'Set end' : 'Tap point to edit';

  const setAtCrosshair = () => {
    const c = useInteraction.getState().cameraCenter;
    if (c) useMeasure.getState().place(c);
  };

  // Icon-only buttons leave the hint room on a narrow phone.
  return (
    <MapHintBar testID="measure-bar" hint={hint}>
      {step === 'pick' ? null : <CenterButton compact label="Set at CTR" onPress={setAtCrosshair} />}
      <MenuButton compact iconOnly label="Stop measuring" icon="close" onPress={() => useMeasure.getState().stopMeasure()} />
    </MapHintBar>
  );
}
