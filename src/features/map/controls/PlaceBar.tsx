import { CenterButton } from '@/components/menu/CenterButton';
import { MenuButton } from '@/components/menu/MenuButton';

import { MapHintBar } from './MapHintBar';

/** UNIT / POINT before anything is placed: tap the map, or CTR (add at the crosshair), or Cancel. */
export function PlaceBar({ onAtCenter, onCancel }: { onAtCenter: () => void; onCancel: () => void }) {
  return (
    <MapHintBar testID="place-bar" hint="Tap map">
      <CenterButton compact onPress={onAtCenter} />
      <MenuButton compact label="Cancel" icon="close" iconOnly onPress={onCancel} />
    </MapHintBar>
  );
}
