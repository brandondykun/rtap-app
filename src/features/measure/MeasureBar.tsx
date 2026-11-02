import { Text } from 'react-native';

import { CenterButton } from '@/components/menu/CenterButton';
import { MenuButton } from '@/components/menu/MenuButton';
import { MapHintBar } from '@/features/map/controls/MapHintBar';
import { useInteraction } from '@/stores/interaction';
import { useMeasure } from '@/stores/measure';
import { useSettings } from '@/stores/settings';
import { VALUE_TEXT_CLASS } from '@/theme/value-colors';

import { measureParts } from './measure-readout';

/** While measuring, in place of your grid card: what to set next (or the readout), Set at CTR and Stop. */
export function MeasureBar() {
  const start = useMeasure((s) => s.start);
  const end = useMeasure((s) => s.end);
  const angleUnit = useSettings((s) => s.angleUnit);
  const northRef = useSettings((s) => s.northRef);
  const declinationOverrideDeg = useSettings((s) => s.declinationOverrideDeg);
  const parts = start && end ? measureParts(start, end, { angleUnit, northRef, declinationOverrideDeg }) : null;
  // The distance and bearing each in their value color.
  const readout = !start ? (
    'Set start'
  ) : !parts ? (
    'Set end'
  ) : (
    <Text accessibilityLabel={`${parts.distance} · ${parts.bearing}`}>
      <Text className={VALUE_TEXT_CLASS.distance}>{parts.distance}</Text>
      {' · '}
      <Text className={VALUE_TEXT_CLASS.bearing}>{parts.bearing}</Text>
    </Text>
  );

  const setAtCrosshair = () => {
    const c = useInteraction.getState().cameraCenter;
    if (c) useMeasure.getState().place(c);
  };

  // Icon-only buttons leave the readout room on a narrow phone.
  return (
    <MapHintBar testID="measure-bar" hint={readout} mono={!!(start && end)}>
      <CenterButton compact label="Set at CTR" onPress={setAtCrosshair} />
      <MenuButton compact iconOnly label="Stop measuring" icon="close" onPress={() => useMeasure.getState().stopMeasure()} />
    </MapHintBar>
  );
}
