import { View } from 'react-native';

import type { ItemCategory } from '@/features/symbology/categories';

import type { MapItemSnapshot } from '../../repository';
import { ITEM_COPY } from '../item-menus';
import { ItemActions } from './ItemActions';
import { LocationCard } from './LocationCard';
import { NotesPreview } from './NotesPreview';

/** The condensed read-only view of a unit or point: location, actions, notes. */
export function ItemView({ category, item, hidden, onEdit, onDelete }: { category: ItemCategory; item: MapItemSnapshot; hidden: boolean; onEdit: () => void; onDelete: () => void }) {
  return (
    <View className="gap-3 px-4 pb-4">
      <LocationCard item={item} />
      <ItemActions item={item} hidden={hidden} noun={ITEM_COPY[category].noun} onDelete={onDelete} />
      <NotesPreview notes={item.notes} onEdit={onEdit} />
    </View>
  );
}
