import { useState } from 'react';
import { Text, View } from 'react-native';

import { MenuButton } from '@/components/menu/MenuButton';
import { MenuSection } from '@/components/menu/MenuSection';
import { MenuSelect } from '@/components/menu/MenuSelect';
import { MenuVertexRow } from '@/components/menu/MenuVertexRow';
import { MgrsInput } from '@/components/menu/MgrsInput';
import { evaluateMgrsFields, mgrsFieldsFor, squareFieldsFor } from '@/components/menu/mgrs-fields';
import { TextField } from '@/components/ui/TextField';
import { notifyRemoved } from '@/features/feedback/feedback';
import { formatCoordinate } from '@/features/map/interaction/readout';
import { LINE_TYPES, lineNamePrefix, type LineType } from '@/features/symbology/line-types';
import { formatDistance } from '@/lib/geo/format/measure';
import type { MgrsParts } from '@/lib/geo/coords/mgrs';
import { useDraft, type DraftMode } from '@/stores/draft';
import { useInteraction } from '@/stores/interaction';
import { useSettings } from '@/stores/settings';
import { VALUE_TEXT_CLASS } from '@/theme/value-colors';

import { canRemove } from '../line-draft';
import { segmentLengths, totalLength } from '../line-measure';
import { NotesSection } from './form/NotesSection';
import { useAutoName } from './form/use-auto-name';
import { LineSample } from './LineSample';

// Listed alphabetically in the dropdown.
const TYPE_OPTIONS = LINE_TYPES.map((t) => ({ value: t.id, label: t.label, keywords: t.prefix ?? undefined, icon: <LineSample lineType={t.id} /> })).sort((a, b) => a.label.localeCompare(b.label));

/** Zone and 100 km square at the map center: typed points are most likely nearby. */
const centerSquare = () => squareFieldsFor(useInteraction.getState().cameraCenter);

/** Add/Edit line: name, type, the point list, a typed point, notes. Edits only the draft store. */
export function LineForm({ missionId, mode }: { missionId: string; mode: DraftMode }) {
  const name = useDraft((s) => s.name);
  const lineType = useDraft((s) => s.lineType);
  const vertices = useDraft((s) => s.vertices);
  const selected = useDraft((s) => s.selectedVertex);
  const insertAfter = useDraft((s) => s.insertAfter);
  const locked = useDraft((s) => s.locked);
  const coordinateFormat = useSettings((s) => s.coordinateFormat);
  const [parts, setParts] = useState<MgrsParts>(centerSquare);
  const status = evaluateMgrsFields(parts);
  const segs = segmentLengths(vertices);
  const edit = { vertices, selected, insertAfter };
  const moving = selected !== null && insertAfter === null;
  useAutoName(missionId, mode, lineNamePrefix(lineType));

  const submitTyped = () => {
    if (status.status !== 'valid') return;
    const d = useDraft.getState();
    if (moving) d.moveVertex(selected, status.coord);
    else d.addVertex(status.coord);
    // The map eases to a typed point (MissionMap follows `coord` changes from typing).
    d.setCoord(status.coord, 'typed');
    // The next point is most likely in the same square.
    setParts(squareFieldsFor(status.coord));
  };

  const select = (i: number) => {
    useDraft.getState().selectVertex(i);
    // Selecting fills the typed-point row with that point's grid for correction.
    setParts(selected === i ? centerSquare() : mgrsFieldsFor(vertices[i]));
  };

  // Only while editing: a saved 2-point line being viewed is fine as it is.
  const blocked = !locked && vertices.length === 2;

  return (
    <View>
      <MenuSection label="Name">
        <TextField mono clearable editable={!locked} accessibilityLabel="Name" value={name} onChangeText={(t) => useDraft.getState().setName(t)} autoCapitalize="characters" autoCorrect={false} maxLength={40} />
      </MenuSection>
      <MenuSection label="Line type">
        <MenuSelect<LineType> label="Line type" options={TYPE_OPTIONS} value={lineType} onChange={(t) => useDraft.getState().setLineType(t)} disabled={locked} />
      </MenuSection>
      <MenuSection label={`POINTS · ${vertices.length}`} trailing={vertices.length >= 2 ? <><Text className={VALUE_TEXT_CLASS.distance}>{formatDistance(totalLength(vertices))}</Text> total</> : undefined}>
        <View>
          {vertices.map((v, i) => (
            <MenuVertexRow
              key={i}
              number={i + 1}
              title={formatCoordinate(v, coordinateFormat)}
              detail={i === 0 ? 'start' : `+${formatDistance(segs[i - 1])}`}
              detailKind={i === 0 ? undefined : 'distance'}
              selected={selected === i}
              disabled={locked}
              onPress={() => select(i)}
              onRemove={() => {
                notifyRemoved();
                useDraft.getState().removeVertex(i);
              }}
              removeDisabled={!canRemove(edit, i)}
              onInsertAfter={() => useDraft.getState().startInsertAfter(i)}
              inserting={insertAfter === i}
              onInsertDone={() => useDraft.getState().selectVertex(null)}
            />
          ))}
        </View>
        {blocked ? <Text className="text-sm text-text-muted">A line needs at least 2 points</Text> : null}
      </MenuSection>
      {locked ? null : (
        <MenuSection label={moving ? `Move point ${selected! + 1}` : 'New point'}>
          <MgrsInput value={parts} onChange={setParts} status={status} onSubmit={submitTyped} />
          <MenuButton
            label={moving ? `Move point ${selected! + 1} to typed grid` : 'Add new point'}
            icon={moving ? 'check' : 'plus'}
            onPress={submitTyped}
            disabled={status.status !== 'valid'}
          />
        </MenuSection>
      )}
      <NotesSection />
    </View>
  );
}
