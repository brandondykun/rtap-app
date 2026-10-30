import { View } from 'react-native';

import { lineTypeInfo, lineTypeOf } from '@/features/symbology/line-types';
import { useTheme } from '@/theme/ThemeProvider';

import { parseLineGeometry } from '../../geometry';
import type { MapItemSnapshot } from '../../repository';
import { LineSample } from '../LineSample';
import { IdentityBlock } from './IdentityBlock';
import { ItemPoints } from './ItemPoints';
import { NotesPreview } from './NotesPreview';
import { ShapeActions } from './ShapeActions';

/** The condensed read-only view of a line: what it is, actions, its points, notes. No data card: lines need no numbers at a glance. */
export function LineView({ item, hidden, onEditNotes, onDelete }: { item: MapItemSnapshot; hidden: boolean; onEditNotes: () => void; onDelete: () => void }) {
  const { colors } = useTheme();
  const points = parseLineGeometry(item.geometry);
  if (!points) return null;
  const lineType = lineTypeOf(item.style);
  const typeLabel = lineTypeInfo(lineType).label;
  const rest = ` · ${points.length} points`;
  return (
    <View className="gap-3 px-4 pb-4">
      <IdentityBlock
        testID="line-title"
        accessibilityLabel={`${item.name}, ${typeLabel}${rest}${hidden ? ', hidden' : ''}`}
        icon={
          <View className="w-10 items-center">
            <LineSample lineType={lineType} width={36} />
          </View>
        }
        name={item.name}
        lead={typeLabel}
        // Lines are drawn in the friendly color (as LineSample does).
        leadColor={colors.friendly}
        rest={rest}
        hidden={hidden}
      />
      <ShapeActions id={item.id} lengths hidden={hidden} onDelete={onDelete} />
      <ItemPoints points={points} />
      <NotesPreview notes={item.notes} onEdit={onEditNotes} />
    </View>
  );
}
