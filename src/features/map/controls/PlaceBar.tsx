import { MenuButton } from '@/components/menu/MenuButton';
import { CrosshairGlyph } from '@/components/ui/CrosshairGlyph';
import type { PlacingCategory } from '@/stores/placing';
import { useTheme } from '@/theme/ThemeProvider';

import { MapHintBar } from './MapHintBar';

/** UNIT / POINT before anything is placed: tap the map, or Add at center (the crosshair), or Cancel. Landscape keeps it short. */
export function PlaceBar({
  category,
  landscape,
  onAtCenter,
  onCancel,
}: {
  category: PlacingCategory;
  landscape: boolean;
  onAtCenter: () => void;
  onCancel: () => void;
}) {
  const { colors } = useTheme();
  // Rendered in the bottom-left stack (no panel is open while placing): under the readout, or beside it in landscape.
  return (
    <MapHintBar testID="place-bar" panel="inline" hint={landscape ? 'Tap map' : `Tap map to add a ${category}`}>
      <MenuButton label="Add at center" icon={<CrosshairGlyph size={16} color={colors.text} />} onPress={onAtCenter} />
      <MenuButton label="Cancel" icon="close" iconOnly onPress={onCancel} />
    </MapHintBar>
  );
}
