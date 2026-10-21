import { Host, Slider } from '@expo/ui';
import { Text, View } from 'react-native';

import { MenuButton } from '@/components/menu/MenuButton';
import { formatLength } from '@/features/location/gps-format';
import { formatAngle, refLabel } from '@/lib/geo/format/measure';
import { fromTrue } from '@/lib/geo/north/convert';
import { OP_EYE_RANGE, useOp } from '@/stores/op';
import { useSettings } from '@/stores/settings';

/** The amber-outlined bar while standing at an OP: eye height slider, where the view faces, magnification, Exit. */
export function OpBar({ onExit }: { onExit: () => void }) {
  const at = useOp((s) => s.at);
  const eyeM = useOp((s) => s.eyeM);
  const bearing = useOp((s) => s.bearing);
  const zoom = useOp((s) => s.zoom);
  const altitudeUnit = useSettings((s) => s.altitudeUnit);
  const angleUnit = useSettings((s) => s.angleUnit);
  const northRef = useSettings((s) => s.northRef);
  const declinationOverrideDeg = useSettings((s) => s.declinationOverrideDeg);
  const facing = at ? formatAngle(fromTrue(bearing, northRef, at, { date: new Date(), declinationOverrideDeg }), angleUnit) : '—';
  return (
    <View testID="op-bar" className="flex-row items-center gap-3 rounded-2xl border border-accent bg-surface-chrome p-2 pl-3">
      <View className="shrink">
        <Text className="font-mono text-sm font-semibold text-text">Eye {formatLength(eyeM, altitudeUnit)}</Text>
        <Host matchContents={{ vertical: true }} style={{ width: 140 }}>
          <Slider testID="op-eye" value={eyeM} onValueChange={(v) => useOp.getState().setEye(v)} min={OP_EYE_RANGE[0]} max={OP_EYE_RANGE[1]} step={1} />
        </Host>
      </View>
      <View className="items-end">
        <Text className="font-mono text-sm font-semibold text-text">
          {facing} {refLabel(northRef)}
        </Text>
        {zoom > 1 ? <Text className="font-mono text-sm text-text-muted">{zoom.toFixed(1)}×</Text> : null}
      </View>
      <MenuButton compact label="Exit" icon="close" onPress={onExit} />
    </View>
  );
}
