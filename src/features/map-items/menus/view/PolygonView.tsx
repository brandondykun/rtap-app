import { View } from 'react-native';

import { polygonTypeInfo } from '@/features/symbology/polygon-types';
import { useTheme } from '@/theme/ThemeProvider';

import type { MapItemSnapshot } from '../../repository';
import { IdentityBlock } from './IdentityBlock';
import { ItemPoints } from './ItemPoints';
import { NotesPreview } from './NotesPreview';
import { PolygonCard } from './PolygonCard';
import { polygonSummary } from './polygon-summary';
import { ShapeActions } from './ShapeActions';
import { PolygonSample } from '../PolygonSample';

/** The condensed read-only view of a polygon: what it is, where, actions, its points, notes. */
export function PolygonView({ item, hidden, onEditNotes, onDelete }: { item: MapItemSnapshot; hidden: boolean; onEditNotes: () => void; onDelete: () => void }) {
  const { colors } = useTheme();
  const summary = polygonSummary(item);
  if (!summary) return null;
  const circle = summary.kind === 'circle';
  return (
    <View className="gap-3 px-4 pb-4">
      <IdentityBlock
        testID="polygon-title"
        accessibilityLabel={`${item.name}, ${summary.subtitle}${hidden ? ', hidden' : ''}`}
        icon={<PolygonSample polygonType={summary.polygonType} size={40} />}
        name={item.name}
        lead={summary.typeLabel}
        leadColor={colors[polygonTypeInfo(summary.polygonType).color]}
        rest={summary.subtitle.slice(summary.typeLabel.length)}
        hidden={hidden}
      />
      <PolygonCard summary={summary} />
      <ShapeActions id={item.id} lengths={!circle} hidden={hidden} onDelete={onDelete} />
      {circle ? null : <ItemPoints points={summary.points} />}
      <NotesPreview notes={item.notes} onEdit={onEditNotes} />
    </View>
  );
}
