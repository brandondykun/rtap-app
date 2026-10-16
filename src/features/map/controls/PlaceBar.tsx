import { MenuButton } from '@/components/menu/MenuButton';
import { CrosshairGlyph } from '@/components/ui/CrosshairGlyph';
import { useTheme } from '@/theme/ThemeProvider';

import { MapHintBar } from './MapHintBar';

/** UNIT / POINT before anything is placed: tap the map, or Add at center (the crosshair), or Cancel. */
export function PlaceBar({ onAtCenter, onCancel }: { onAtCenter: () => void; onCancel: () => void }) {
  const { colors } = useTheme();
  // Rendered in the bottom-left stack (no panel is open while placing): under the readout, or beside it in landscape.
  return (
    <MapHintBar testID="place-bar" panel="inline" hint="Tap map">
      <MenuButton label="Add at center" icon={<CrosshairGlyph size={16} color={colors.text} />} onPress={onAtCenter} />
      <MenuButton label="Cancel" icon="close" iconOnly onPress={onCancel} />
    </MapHintBar>
  );
}
