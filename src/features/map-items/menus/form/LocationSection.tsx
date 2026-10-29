import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { CenterButton } from '@/components/menu/CenterButton';
import { MenuButton } from '@/components/menu/MenuButton';
import { MenuSection } from '@/components/menu/MenuSection';
import { MgrsInput } from '@/components/menu/MgrsInput';
import { EMPTY_MGRS, evaluateMgrsFields, mgrsFieldsFor } from '@/components/menu/mgrs-fields';
import type { MgrsParts } from '@/lib/geo/coords/mgrs';
import { useTheme } from '@/theme/ThemeProvider';
import { useDraft } from '@/stores/draft';
import { useInteraction } from '@/stores/interaction';

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


  const toCrosshair = () => {
    const center = useInteraction.getState().cameraCenter;
    if (center) setCoord(center, 'crosshair');
  };

  return (
    <MenuSection label="MGRS · Zone / 100K / Easting / Northing">
      <MgrsInput value={parts} onChange={onPartsChange} status={status} disabled={locked} showStatus={false} />
      <View className="flex-row items-center gap-2">
        <View className="flex-1 gap-0.5">
          <View testID="location-status-line" className="min-h-5 flex-row items-center gap-1">
            {status.status === 'valid' || status.status === 'invalid' ? (
              <>
                <Icon name={status.status === 'valid' ? 'check' : 'alert-circle-outline'} size={16} color={status.status === 'valid' ? colors.success : colors.danger} />
                <Text testID="location-status" numberOfLines={1} adjustsFontSizeToFit className={`shrink text-sm ${status.status === 'valid' ? 'text-success' : 'text-danger'}`}>
                  {status.status === 'valid' ? 'Valid' : status.message}
                </Text>
              </>
            ) : null}
          </View>
          {noun === 'center' ? null : <ElevationRow />}
        </View>
        <CenterButton compact label="Center" onPress={toCrosshair} disabled={locked} />
        <MenuButton compact label="Map" icon="gesture-tap" onPress={() => setPicking(!picking)} active={picking} disabled={locked} />
      </View>
      {picking ? <Text className="text-sm text-accent">{`Tap the map where the ${noun} should go`}</Text> : null}
    </MenuSection>
  );
}
