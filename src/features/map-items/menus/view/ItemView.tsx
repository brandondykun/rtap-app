import { View } from 'react-native';

import type { MapItemSnapshot } from '../../repository';
import { ItemActions } from './ItemActions';
import { LocationCard } from './LocationCard';
import { NotesPreview } from './NotesPreview';

/** The condensed read-only view of a unit or point: location, actions, notes. */
export function ItemView({ item, hidden, onEdit, onDelete }: { item: MapItemSnapshot; hidden: boolean; onEdit: () => void; onDelete: () => void }) {
  return (
    <View className="gap-3 px-4 pb-4">
      <LocationCard item={item} />
      <ItemActions item={item} hidden={hidden} onDelete={onDelete} />
      <NotesPreview notes={item.notes} onEdit={onEdit} />
    </View>
  );
}
