import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { MenuButton } from '@/components/menu/MenuButton';
import { MenuSection } from '@/components/menu/MenuSection';
import { MenuSegmented } from '@/components/menu/MenuSegmented';
import { MenuSelect } from '@/components/menu/MenuSelect';
import { MenuToggle } from '@/components/menu/MenuToggle';
import { MenuVertexRow } from '@/components/menu/MenuVertexRow';
import { MgrsInput } from '@/components/menu/MgrsInput';
import { EMPTY_MGRS, evaluateMgrsFields, mgrsFieldsFor } from '@/components/menu/mgrs-fields';
import { TextField } from '@/components/ui/TextField';
import { formatCoordinate } from '@/features/map/interaction/readout';
import { POLYGON_TYPES, type PolygonType } from '@/features/symbology/polygon-types';
import type { MgrsParts } from '@/lib/geo/coords/mgrs';
import { formatDistance } from '@/lib/geo/format/measure';
import { useDraft } from '@/stores/draft';
import { useSettings } from '@/stores/settings';

import { canRemove } from '../line-draft';
import { segmentLengths } from '../line-measure';
import { areaM2, circleRing, formatArea, perimeterM } from '../polygon-measure';
import { LocationSection } from './form/LocationSection';
import { PolygonSample } from './PolygonSample';

// Listed alphabetically in the dropdown.
const TYPE_OPTIONS = POLYGON_TYPES.map((t) => ({ value: t.id, label: t.label, icon: <PolygonSample polygonType={t.id} /> })).sort((a, b) =>
  a.label.localeCompare(b.label),
);
const SHAPES = [
  { value: 'points' as const, label: 'Points' },
  { value: 'circle' as const, label: 'Circle' },
];
const UNITS = [
  { value: 'm' as const, label: 'm' },
  { value: 'km' as const, label: 'km' },
];

const radiusText = (m: number | null, unit: 'm' | 'km') => (m === null ? '' : unit === 'km' ? String(Number((m / 1000).toFixed(3))) : String(Math.round(m)));

/** Add/Edit polygon: name, type, shape (points list or circle center + radius), notes. Edits only the draft store. */
export function PolygonForm() {
  const name = useDraft((s) => s.name);
  const notes = useDraft((s) => s.notes);
  const polygonType = useDraft((s) => s.polygonType);
  const shape = useDraft((s) => s.polygonShape);
  const vertices = useDraft((s) => s.vertices);
  const selected = useDraft((s) => s.selectedVertex);
  const insertAfter = useDraft((s) => s.insertAfter);
  const center = useDraft((s) => s.coord);
  const radiusM = useDraft((s) => s.circleRadiusM);
  const locked = useDraft((s) => s.locked);
  const coordinateFormat = useSettings((s) => s.coordinateFormat);
  const showDistances = useSettings((s) => s.showLineDistances);
  const [parts, setParts] = useState<MgrsParts>(EMPTY_MGRS);
  const [showNotes, setShowNotes] = useState(notes !== '');
  const [unit, setUnit] = useState<'m' | 'km'>(radiusM !== null && radiusM >= 1000 ? 'km' : 'm');
  const [radius, setRadius] = useState(() => radiusText(radiusM, unit));
  const status = evaluateMgrsFields(parts);
  const segs = segmentLengths(vertices);
  const edit = { vertices, selected, insertAfter };
  const moving = selected !== null && insertAfter === null;

  // A radius set on the map (edge tap) rewrites the field; typing does not fight it.
  useEffect(() => {
    const typed = Number(radius) * (unit === 'km' ? 1000 : 1);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing field text from an external store change
    if (radiusM !== null && Math.abs(typed - radiusM) > 0.5) setRadius(radiusText(radiusM, unit));
  }, [radiusM]); // eslint-disable-line react-hooks/exhaustive-deps

  const onRadius = (text: string) => {
    setRadius(text);
    const value = text.trim() === '' ? NaN : Number(text);
    useDraft.getState().setCircleRadius(value * (unit === 'km' ? 1000 : 1));
  };
  const onUnit = (next: 'm' | 'km') => {
    setUnit(next);
    const value = radius.trim() === '' ? NaN : Number(radius);
    useDraft.getState().setCircleRadius(value * (next === 'km' ? 1000 : 1));
  };

  const submitTyped = () => {
    if (status.status !== 'valid') return;
    const d = useDraft.getState();
    if (moving) d.moveVertex(selected, status.coord);
    else d.addVertex(status.coord);
    setParts(EMPTY_MGRS);
  };
  const select = (i: number) => {
    useDraft.getState().selectVertex(i);
    setParts(selected === i ? EMPTY_MGRS : mgrsFieldsFor(vertices[i]));
  };

  const blocked = !locked && vertices.length === 3;
  const pointsTrailing = vertices.length >= 3 ? `${formatDistance(perimeterM(vertices))} · ${formatArea(areaM2(vertices))}` : undefined;
  const circleArea = center && radiusM ? formatArea(areaM2(circleRing(center, radiusM))) : undefined;

  return (
    <View>
      <MenuSection label="Name">
        <TextField mono editable={!locked} accessibilityLabel="Name" value={name} onChangeText={(t) => useDraft.getState().setName(t)} autoCapitalize="characters" autoCorrect={false} maxLength={40} />
      </MenuSection>
      <MenuSection label="Polygon type">
        <MenuSelect<PolygonType> label="Polygon type" options={TYPE_OPTIONS} value={polygonType} onChange={(t) => useDraft.getState().setPolygonType(t)} disabled={locked} />
      </MenuSection>
      <MenuSection label="Shape">
        <MenuSegmented<'points' | 'circle'> options={SHAPES} value={shape} onChange={(s) => useDraft.getState().setPolygonShape(s)} disabled={locked} />
      </MenuSection>
      {shape === 'points' ? (
        <>
          <MenuSection label={`POINTS · ${vertices.length}`} trailing={pointsTrailing}>
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
                removeDisabled={!canRemove(edit, i, 3)}
                onInsertAfter={() => useDraft.getState().startInsertAfter(i)}
              />
            ))}
            {blocked ? <Text className="text-sm text-text-muted">A polygon needs at least 3 points</Text> : null}
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
        </>
      ) : (
        <>
          <LocationSection />
          <MenuSection label="Radius" trailing={circleArea}>
            <View className="flex-row items-center gap-2">
              <View className="flex-1">
                <TextField mono editable={!locked} accessibilityLabel="Radius" value={radius} onChangeText={onRadius} keyboardType="decimal-pad" placeholder="500" />
              </View>
              <View style={{ width: 120 }}>
                <MenuSegmented<'m' | 'km'> options={UNITS} value={unit} onChange={onUnit} disabled={locked} />
              </View>
            </View>
          </MenuSection>
        </>
      )}
      <MenuSection>
        <MenuButton label="Notes" icon="message-text-outline" onPress={() => setShowNotes((s) => !s)} disabled={locked} />
        {showNotes ? <TextField editable={!locked} accessibilityLabel="Notes" value={notes} onChangeText={(t) => useDraft.getState().setNotes(t)} multiline placeholder="Notes" /> : null}
      </MenuSection>
      {shape === 'points' ? (
        <MenuSection>
          <MenuToggle label="Show point distances" value={showDistances} onValueChange={(v) => useSettings.getState().setShowLineDistances(v)} />
        </MenuSection>
      ) : null}
    </View>
  );
}
