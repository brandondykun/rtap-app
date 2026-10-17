import { MenuButton } from '@/components/menu/MenuButton';
import { CrosshairGlyph } from '@/components/ui/CrosshairGlyph';
import { useTheme } from '@/theme/ThemeProvider';

import { MapHintBar } from './MapHintBar';

/** UNIT / POINT before anything is placed: tap the map, or Add at center (the crosshair), or Cancel. */
export function PlaceBar({ onAtCenter, onCancel }: { onAtCenter: () => void; onCancel: () => void }) {
  const { colors } = useTheme();
  return (
    <MapHintBar testID="place-bar" hint="Tap map">
      <MenuButton compact label="Add at center" icon={<CrosshairGlyph size={14} color={colors.text} />} onPress={onAtCenter} />
      <MenuButton compact label="Cancel" icon="close" iconOnly onPress={onCancel} />
    </MapHintBar>
  );
}
