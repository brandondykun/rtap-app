import { CenterButton } from '@/components/menu/CenterButton';
import { MenuButton } from '@/components/menu/MenuButton';

import { MapHintBar } from './MapHintBar';

/** UNIT / POINT before anything is placed: tap the map, or CTR (add at the crosshair), or Cancel. */
export function PlaceBar({ onAtCenter, onCancel, hint = 'Tap map' }: { onAtCenter: () => void; onCancel: () => void; hint?: string }) {
  return (
    <MapHintBar testID="place-bar" hint={hint}>
      <CenterButton compact onPress={onAtCenter} />
      <MenuButton compact label="Cancel" icon="close" iconOnly onPress={onCancel} />
    </MapHintBar>
  );
}
