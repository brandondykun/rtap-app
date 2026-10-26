import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { MenuButton } from '@/components/menu/MenuButton';
import { MenuSection } from '@/components/menu/MenuSection';
import { MenuSegmented } from '@/components/menu/MenuSegmented';
import { MenuSelect } from '@/components/menu/MenuSelect';
import { MenuToggle } from '@/components/menu/MenuToggle';
import { MenuVertexRow } from '@/components/menu/MenuVertexRow';
import { MgrsInput } from '@/components/menu/MgrsInput';
import { evaluateMgrsFields, mgrsFieldsFor, squareFieldsFor } from '@/components/menu/mgrs-fields';
import { TextField } from '@/components/ui/TextField';
import { formatCoordinate } from '@/features/map/interaction/readout';
import { POLYGON_FILLS, POLYGON_TYPES, polygonTypeInfo, type PolygonFill, type PolygonType } from '@/features/symbology/polygon-types';
import type { MgrsParts } from '@/lib/geo/coords/mgrs';
import { formatDistance } from '@/lib/geo/format/measure';
import { useDraft, type DraftMode } from '@/stores/draft';
import { useInteraction } from '@/stores/interaction';
import { useSettings } from '@/stores/settings';

import { canRemove } from '../line-draft';
import { segmentLengths } from '../line-measure';
import { areaM2, circleRing, formatArea, perimeterM } from '../polygon-measure';
import { LocationSection } from './form/LocationSection';
import { NotesSection } from './form/NotesSection';
import { useAutoName } from './form/use-auto-name';
import { PolygonSample } from './PolygonSample';

// Listed alphabetically in the dropdown.
const TYPE_OPTIONS = POLYGON_TYPES.map((t) => ({ value: t.id, label: t.label, icon: <PolygonSample polygonType={t.id} /> })).sort((a, b) =>
  a.label.localeCompare(b.label),
);
const FILLS = POLYGON_FILLS.map((f) => ({ value: f.id, label: f.label }));
const SHAPES = [
  { value: 'points' as const, label: 'Points' },
  { value: 'circle' as const, label: 'Circle' },
];
const UNITS = [
  { value: 'm' as const, label: 'm' },
  { value: 'km' as const, label: 'km' },
];

// A decimal comma (many locales' keypads) counts as a point.
const parseRadius = (text: string) => (text.trim() === '' ? NaN : Number(text.replace(',', '.')));
const radiusText = (m: number | null, unit: 'm' | 'km') => (m === null ? '' : unit === 'km' ? String(Number((m / 1000).toFixed(3))) : String(Math.round(m)));

/** Zone and 100 km square at the map center: typed points are most likely nearby. */
const centerSquare = () => squareFieldsFor(useInteraction.getState().cameraCenter);

/** Add/Edit polygon: name, type, fill, shape (points list or circle center + radius), notes. Edits only the draft store. */
export function PolygonForm({ missionId, mode }: { missionId: string; mode: DraftMode }) {
  const name = useDraft((s) => s.name);
  const polygonType = useDraft((s) => s.polygonType);
  useAutoName(missionId, mode, polygonTypeInfo(polygonType).prefix);
  const fill = useDraft((s) => s.polygonFill);
  const shape = useDraft((s) => s.polygonShape);
  const vertices = useDraft((s) => s.vertices);
  const selected = useDraft((s) => s.selectedVertex);
  const insertAfter = useDraft((s) => s.insertAfter);
  const center = useDraft((s) => s.coord);
  const radiusM = useDraft((s) => s.circleRadiusM);
  const locked = useDraft((s) => s.locked);
  const coordinateFormat = useSettings((s) => s.coordinateFormat);
  const showDistances = useSettings((s) => s.showLineDistances);
  const [parts, setParts] = useState<MgrsParts>(centerSquare);
  const [unit, setUnit] = useState<'m' | 'km'>(radiusM !== null && radiusM >= 1000 ? 'km' : 'm');
  const [radius, setRadius] = useState(() => radiusText(radiusM, unit));
  const status = evaluateMgrsFields(parts);
  const segs = segmentLengths(vertices);
  const edit = { vertices, selected, insertAfter };
  const moving = selected !== null && insertAfter === null;

  // A radius set on the map (edge tap) rewrites the field; typing does not fight it.
  useEffect(() => {
    const typed = parseRadius(radius) * (unit === 'km' ? 1000 : 1);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing field text from an external store change
    if (radiusM !== null && Math.abs(typed - radiusM) > 0.5) setRadius(radiusText(radiusM, unit));
  }, [radiusM]); // eslint-disable-line react-hooks/exhaustive-deps

  const onRadius = (text: string) => {
    setRadius(text);
    useDraft.getState().setCircleRadius(parseRadius(text) * (unit === 'km' ? 1000 : 1));
  };
  // Switching the unit converts the shown number; the circle keeps its size.
  const onUnit = (next: 'm' | 'km') => {
    setUnit(next);
    if (radiusM !== null) setRadius(radiusText(radiusM, next));
  };

  const submitTyped = () => {
    if (status.status !== 'valid') return;
    const d = useDraft.getState();
    if (moving) d.moveVertex(selected, status.coord);
    else d.addVertex(status.coord);
    // The next point is most likely in the same square.
    setParts(squareFieldsFor(status.coord));
  };
  const select = (i: number) => {
    useDraft.getState().selectVertex(i);
    setParts(selected === i ? centerSquare() : mgrsFieldsFor(vertices[i]));
  };

  const blocked = !locked && vertices.length === 3;
  const pointsTrailing = vertices.length >= 3 ? `${formatDistance(perimeterM(vertices))} · ${formatArea(areaM2(vertices))}` : undefined;
  const circleArea = center && radiusM ? formatArea(areaM2(circleRing(center, radiusM))) : undefined;

  return (
    <View>
      <MenuSection label="Name">
        <TextField mono clearable editable={!locked} accessibilityLabel="Name" value={name} onChangeText={(t) => useDraft.getState().setName(t)} autoCapitalize="characters" autoCorrect={false} maxLength={40} />
      </MenuSection>
      <MenuSection label="Polygon type">
        <MenuSelect<PolygonType> label="Polygon type" options={TYPE_OPTIONS} value={polygonType} onChange={(t) => useDraft.getState().setPolygonType(t)} disabled={locked} />
      </MenuSection>
      <MenuSection label="Fill">
        <MenuSegmented<PolygonFill> options={FILLS} value={fill} onChange={(f) => useDraft.getState().setPolygonFill(f)} disabled={locked} />
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
                inserting={insertAfter === i}
                onInsertDone={() => useDraft.getState().selectVertex(null)}
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
      <NotesSection />
      {shape === 'points' ? (
        <MenuSection>
          <MenuToggle label="Show point distances" value={showDistances} onValueChange={(v) => useSettings.getState().setShowLineDistances(v)} />
        </MenuSection>
      ) : null}
    </View>
  );
}
