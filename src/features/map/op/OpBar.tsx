import { Text, View } from 'react-native';

import { MenuButton } from '@/components/menu/MenuButton';
import { useOp } from '@/stores/op';

/** The amber-outlined bar while standing at an OP: magnification and Exit (eye height is OpEyeSlider). */
export function OpBar({ onExit }: { onExit: () => void }) {
  const zoom = useOp((s) => s.zoom);
  return (
    <View testID="op-bar" className="flex-row flex-wrap items-center justify-center gap-x-3 gap-y-2 rounded-2xl border border-accent bg-surface-chrome p-2 pl-3">
      {zoom > 1 ? <Text className="font-mono text-sm text-text-muted">{zoom.toFixed(1)}×</Text> : null}
      <MenuButton compact label="Exit" icon="close" onPress={onExit} />
    </View>
  );
}
