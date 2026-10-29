import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { CenterButton } from '@/components/menu/CenterButton';
import { MenuButton } from '@/components/menu/MenuButton';
import { MenuSection } from '@/components/menu/MenuSection';
import { MgrsInput } from '@/components/menu/MgrsInput';
import { EMPTY_MGRS, evaluateMgrsFields, mgrsFieldsFor } from '@/components/menu/mgrs-fields';
import type { MgrsParts } from '@/lib/geo/coords/mgrs';
import { describeVector } from '@/lib/geo/vector';
import { useTheme } from '@/theme/ThemeProvider';
import { useDraft } from '@/stores/draft';
import { useInteraction } from '@/stores/interaction';
import { usePresence } from '@/stores/presence';
import { useSettings } from '@/stores/settings';

import { ElevationRow } from './ElevationRow';

/** The draft's location: MGRS fields, Center (crosshair) and Map (tap to place), and its elevation. Shared by units and points. */
export function LocationSection() {
  const { colors } = useTheme();
  const coord = useDraft((s) => s.coord);
  const coordRev = useDraft((s) => s.coordRev);
  const coordSource = useDraft((s) => s.coordSource);
  const locked = useDraft((s) => s.locked);
  const picking = useDraft((s) => s.picking);
  const noun = useDraft((s) => (s.category === 'point' ? 'point' : s.category === 'polygon' ? 'center' : 'unit'));
  const setPicking = useDraft((s) => s.setPicking);
  const setCoord = useDraft((s) => s.setCoord);
  const setCoordInputValid = useDraft((s) => s.setCoordInputValid);
  const self = usePresence((s) => s.selfPosition?.position ?? null);
  const angleUnit = useSettings((s) => s.angleUnit);
  const northRef = useSettings((s) => s.northRef);
  const declinationOverrideDeg = useSettings((s) => s.declinationOverrideDeg);

  const [parts, setParts] = useState<MgrsParts>(() => (coord ? mgrsFieldsFor(coord) : EMPTY_MGRS));

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

  const v = self && coord ? describeVector(self, coord, { date: new Date(), declinationOverrideDeg, unit: angleUnit, ref: northRef }) : null;
  const detail = v ? `${v.distanceLabel} · ${v.bearingLabel} ${v.refLabel}` : undefined;

  const toCrosshair = () => {
    const center = useInteraction.getState().cameraCenter;
    if (center) setCoord(center, 'crosshair');
  };

  return (
    <MenuSection label="MGRS · Zone / 100K / Easting / Northing">
      <MgrsInput value={parts} onChange={onPartsChange} status={status} disabled={locked} showStatus={false} />
      <View className="flex-row items-center gap-2">
        <View className="flex-1 gap-0.5">
          {status.status === 'valid' || status.status === 'invalid' ? (
            <View className="flex-row items-center gap-1">
              <Icon name={status.status === 'valid' ? 'check' : 'alert-circle-outline'} size={16} color={status.status === 'valid' ? colors.success : colors.danger} />
              <Text testID="location-status" className={`shrink text-sm ${status.status === 'valid' ? 'text-success' : 'text-danger'}`}>
                {status.status === 'valid' ? detail ?? 'Valid' : status.message}
              </Text>
            </View>
          ) : null}
          {noun === 'center' ? null : <ElevationRow inline />}
        </View>
        <CenterButton compact label="Center" onPress={toCrosshair} disabled={locked} />
        <MenuButton compact label="Map" icon="gesture-tap" onPress={() => setPicking(!picking)} active={picking} disabled={locked} />
      </View>
      {picking ? <Text className="text-sm text-accent">{`Tap the map where the ${noun} should go`}</Text> : null}
    </MenuSection>
  );
}
