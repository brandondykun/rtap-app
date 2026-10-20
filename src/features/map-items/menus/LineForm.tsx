import { useState } from 'react';
import { Text, View } from 'react-native';

import { MenuButton } from '@/components/menu/MenuButton';
import { MenuSection } from '@/components/menu/MenuSection';
import { MenuSelect } from '@/components/menu/MenuSelect';
import { MenuToggle } from '@/components/menu/MenuToggle';
import { MenuVertexRow } from '@/components/menu/MenuVertexRow';
import { MgrsInput } from '@/components/menu/MgrsInput';
import { EMPTY_MGRS, evaluateMgrsFields, mgrsFieldsFor } from '@/components/menu/mgrs-fields';
import { TextField } from '@/components/ui/TextField';
import { formatCoordinate } from '@/features/map/interaction/readout';
import { LINE_TYPES, lineNamePrefix, type LineType } from '@/features/symbology/line-types';
import { formatDistance } from '@/lib/geo/format/measure';
import type { MgrsParts } from '@/lib/geo/coords/mgrs';
import { useDraft, type DraftMode } from '@/stores/draft';
import { useSettings } from '@/stores/settings';

import { canRemove } from '../line-draft';
import { segmentLengths, totalLength } from '../line-measure';
import { useAutoName } from './form/use-auto-name';
import { LineSample } from './LineSample';

// Listed alphabetically in the dropdown.
const TYPE_OPTIONS = LINE_TYPES.map((t) => ({ value: t.id, label: t.label, icon: <LineSample lineType={t.id} /> })).sort((a, b) => a.label.localeCompare(b.label));

/** Add/Edit line: name, type, the point list, a typed point, notes. Edits only the draft store. */
export function LineForm({ missionId, mode }: { missionId: string; mode: DraftMode }) {
  const name = useDraft((s) => s.name);
  const notes = useDraft((s) => s.notes);
  const lineType = useDraft((s) => s.lineType);
  const vertices = useDraft((s) => s.vertices);
  const selected = useDraft((s) => s.selectedVertex);
  const insertAfter = useDraft((s) => s.insertAfter);
  const locked = useDraft((s) => s.locked);
  const coordinateFormat = useSettings((s) => s.coordinateFormat);
  const showDistances = useSettings((s) => s.showLineDistances);
  const [parts, setParts] = useState<MgrsParts>(EMPTY_MGRS);
  const [showNotes, setShowNotes] = useState(notes !== '');
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
    setParts(EMPTY_MGRS);
  };

  const select = (i: number) => {
    useDraft.getState().selectVertex(i);
    // Selecting fills the typed-point row with that point's grid for correction.
    setParts(selected === i ? EMPTY_MGRS : mgrsFieldsFor(vertices[i]));
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
      <MenuSection label={`POINTS · ${vertices.length}`} trailing={vertices.length >= 2 ? `${formatDistance(totalLength(vertices))} total` : undefined}>
        {vertices.map((v, i) => (
          <MenuVertexRow
            key={i}
            number={i + 1}
            title={formatCoordinate(v, coordinateFormat)}
            detail={i === 0 ? 'start' : `+${formatDistance(segs[i - 1])}`}
            selected={selected === i}
            disabled={locked}
            onPress={() => select(i)}
            onRemove={() => useDraft.getState().removeVertex(i)}
            removeDisabled={!canRemove(edit, i)}
            onInsertAfter={() => useDraft.getState().startInsertAfter(i)}
            inserting={insertAfter === i}
            onInsertDone={() => useDraft.getState().selectVertex(null)}
          />
        ))}
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
      <MenuSection>
        <MenuButton label="Notes" icon="message-text-outline" onPress={() => setShowNotes((s) => !s)} disabled={locked} />
        {showNotes ? <TextField editable={!locked} accessibilityLabel="Notes" value={notes} onChangeText={(t) => useDraft.getState().setNotes(t)} multiline placeholder="Notes" /> : null}
      </MenuSection>
      {/* A display preference, not part of the line: it works while viewing too. */}
      <MenuSection>
        <MenuToggle label="Show point distances" value={showDistances} onValueChange={(v) => useSettings.getState().setShowLineDistances(v)} />
      </MenuSection>
    </View>
  );
}
