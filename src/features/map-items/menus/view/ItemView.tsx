import { View } from 'react-native';

import type { ItemCategory } from '@/features/symbology/categories';

import type { MapItemSnapshot } from '../../repository';
import { ItemActions } from './ItemActions';
import { ItemTitle } from './ItemTitle';
import { LocationCard } from './LocationCard';
import { NotesPreview } from './NotesPreview';

/** The condensed read-only view of a unit or point: what it is, where it is, actions, notes. */
export function ItemView({ category, item, hidden, onEditNotes, onDelete }: { category: ItemCategory; item: MapItemSnapshot; hidden: boolean; onEditNotes: () => void; onDelete: () => void }) {
  return (
    <View className="gap-3 px-4 pb-4">
      <ItemTitle category={category} item={item} hidden={hidden} />
      <LocationCard item={item} />
      <ItemActions item={item} hidden={hidden} onDelete={onDelete} />
      <NotesPreview notes={item.notes} onEdit={onEditNotes} />
    </View>
  );
}
