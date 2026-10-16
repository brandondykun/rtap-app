import { MenuButton } from '@/components/menu/MenuButton';
import { CrosshairGlyph } from '@/components/ui/CrosshairGlyph';
import type { PlacingCategory } from '@/stores/placing';
import { useTheme } from '@/theme/ThemeProvider';

import { MapHintBar } from './MapHintBar';

/** UNIT / POINT before anything is placed: tap the map, or Add at center (the crosshair), or Cancel. */
export function PlaceBar({ category, onAtCenter, onCancel }: { category: PlacingCategory; onAtCenter: () => void; onCancel: () => void }) {
  const { colors } = useTheme();
  // Rendered in the bottom-left stack, under the crosshair readout (no panel is open while placing).
  return (
    <MapHintBar testID="place-bar" panel="inline" hint={`Tap map to add a ${category}`}>
      <MenuButton label="Add at center" icon={<CrosshairGlyph size={16} color={colors.text} />} onPress={onAtCenter} />
      <MenuButton label="Cancel" icon="close" iconOnly onPress={onCancel} />
    </MapHintBar>
  );
}
