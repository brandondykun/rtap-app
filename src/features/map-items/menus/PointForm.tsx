import { useEffect, useState } from 'react';
import { Image, Text, View } from 'react-native';

import { MenuButton } from '@/components/menu/MenuButton';
import { MenuSection } from '@/components/menu/MenuSection';
import { MenuSegmented } from '@/components/menu/MenuSegmented';
import { MenuSelect } from '@/components/menu/MenuSelect';
import { MgrsInput } from '@/components/menu/MgrsInput';
import { CrosshairGlyph } from '@/components/ui/CrosshairGlyph';
import { EMPTY_MGRS, evaluateMgrsFields, mgrsFieldsFor } from '@/components/menu/mgrs-fields';
import { TextField } from '@/components/ui/TextField';
import { AFFILIATIONS, composeSidc, UNIT_TYPES, type Affiliation, type UnitType } from '@/features/symbology/presets';
import { SYMBOL_IMAGES } from '@/features/symbology/symbol-images.generated';
import { useCommandContext } from '@/lib/db/command-context-provider';
import type { MgrsParts } from '@/lib/geo/coords/mgrs';
import { describeVector } from '@/lib/geo/vector';
import { useDraft, type DraftMode } from '@/stores/draft';
import { useInteraction } from '@/stores/interaction';
import { usePresence } from '@/stores/presence';
import { useSettings } from '@/stores/settings';
import { useTheme } from '@/theme/ThemeProvider';

import { suggestPointName } from '../repository';

const AFFILIATION_LABELS: Record<Affiliation, string> = { friend: 'Friendly', hostile: 'Hostile', neutral: 'Neutral', unknown: 'Unknown' };
const UNIT_OPTIONS = UNIT_TYPES.map((t) => ({ value: t.id, label: t.label }));

/** The shared Add/Edit point form. It edits only the draft store; the menu decides when to write. */
export function PointForm({ missionId, mode }: { missionId: string; mode: DraftMode }) {
  const ctx = useCommandContext();
  const { colors } = useTheme();
  const coord = useDraft((s) => s.coord);
  const coordRev = useDraft((s) => s.coordRev);
  const coordSource = useDraft((s) => s.coordSource);
  const affiliation = useDraft((s) => s.affiliation);
  const unitType = useDraft((s) => s.unitType);
  const name = useDraft((s) => s.name);
  const nameEdited = useDraft((s) => s.nameEdited);
  const notes = useDraft((s) => s.notes);
  const locked = useDraft((s) => s.locked);
  const picking = useDraft((s) => s.picking);
  const setPicking = useDraft((s) => s.setPicking);
  const setCoord = useDraft((s) => s.setCoord);
  const setCoordInputValid = useDraft((s) => s.setCoordInputValid);
  const setAffiliation = useDraft((s) => s.setAffiliation);
  const setUnitType = useDraft((s) => s.setUnitType);
  const setName = useDraft((s) => s.setName);
  const setNotes = useDraft((s) => s.setNotes);
  const self = usePresence((s) => s.selfPosition?.position ?? null);
  const angleUnit = useSettings((s) => s.angleUnit);
  const northRef = useSettings((s) => s.northRef);
  const declinationOverrideDeg = useSettings((s) => s.declinationOverrideDeg);

  const [parts, setParts] = useState<MgrsParts>(() => (coord ? mgrsFieldsFor(coord) : EMPTY_MGRS));
  const [showNotes, setShowNotes] = useState(notes !== '');

  // External moves (Center, a map pick, long-press, item) rewrite the fields; typing does not.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing local field text from an external store move
    if (coord && coordSource !== 'typed') setParts(mgrsFieldsFor(coord));
  }, [coord, coordSource, coordRev]);

  const status = evaluateMgrsFields(parts);
  useEffect(() => {
    setCoordInputValid(status.status === 'valid');
  }, [status.status, setCoordInputValid]);

  const onPartsChange = (next: MgrsParts) => {
    setParts(next);
    const result = evaluateMgrsFields(next);
    if (result.status === 'valid') setCoord(result.coord, 'typed');
  };

  // Auto-name in add mode whenever the name is empty and the user has not typed one.
  const needsName = mode === 'add' && !nameEdited && name === '';
  useEffect(() => {
    if (!needsName) return;
    let live = true;
    void suggestPointName(ctx.db, missionId, affiliation).then((suggestion) => {
      if (live && useDraft.getState().affiliation === affiliation) useDraft.getState().setAutoName(suggestion);
    });
    return () => {
      live = false;
    };
  }, [needsName, affiliation, ctx, missionId]);

  const v = self && coord ? describeVector(self, coord, { date: new Date(), declinationOverrideDeg, unit: angleUnit, ref: northRef }) : null;
  const validDetail = v ? `${v.distanceLabel} @ ${v.bearingLabel} ${v.refLabel}` : undefined;

  const toCrosshair = () => {
    const center = useInteraction.getState().cameraCenter;
    if (center) setCoord(center, 'crosshair');
  };

  return (
    <View>
      <MenuSection label="MGRS · Zone / 100K / Easting / Northing">
        <MgrsInput value={parts} onChange={onPartsChange} status={status} validDetail={validDetail} disabled={locked} />
        <View className="flex-row gap-2">
          <View className="flex-1">
            <MenuButton label="Center" icon={<CrosshairGlyph size={18} color={colors.text} />} onPress={toCrosshair} disabled={locked} />
          </View>
          <View className="flex-1">
            <MenuButton label="Map" icon="gesture-tap" onPress={() => setPicking(!picking)} active={picking} disabled={locked} />
          </View>
        </View>
        {picking ? <Text className="text-sm text-accent">Tap the map where the point should go</Text> : null}
      </MenuSection>
      <MenuSection label="Affiliation">
        <MenuSegmented<Affiliation>
          options={AFFILIATIONS.map((a) => ({
            value: a,
            label: AFFILIATION_LABELS[a],
            icon: <Image source={SYMBOL_IMAGES[composeSidc(a, 'unspecified')]} style={{ width: 30, height: 22 }} resizeMode="contain" />,
          }))}
          value={affiliation}
          onChange={setAffiliation}
          disabled={locked}
        />
      </MenuSection>
      <MenuSection label="Name">
        <TextField mono editable={!locked} accessibilityLabel="Name" value={name} onChangeText={setName} autoCapitalize="characters" autoCorrect={false} maxLength={40} />
      </MenuSection>
      <MenuSection label="Unit type">
        <View className="flex-row items-start gap-2">
          <MenuSelect<UnitType> label="Unit type" options={UNIT_OPTIONS} value={unitType} onChange={setUnitType} disabled={locked} />
          <MenuButton label="Notes" icon="message-text-outline" onPress={() => setShowNotes((s) => !s)} disabled={locked} />
        </View>
        {showNotes ? <TextField editable={!locked} accessibilityLabel="Notes" value={notes} onChangeText={setNotes} multiline placeholder="Notes" /> : null}
      </MenuSection>
    </View>
  );
}
