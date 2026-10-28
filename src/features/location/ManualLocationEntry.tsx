import { useEffect, useState } from 'react';
import { Keyboard, Pressable, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MenuButton } from '@/components/menu/MenuButton';
import { MgrsInput } from '@/components/menu/MgrsInput';
import { evaluateMgrsFields, mgrsFieldsFor, squareFieldsFor } from '@/components/menu/mgrs-fields';
import { glassHalo } from '@/components/ui/glass';
import { Icon } from '@/components/ui/Icon';
import { EDGE, GAP } from '@/features/map/layout';
import { useToolbarHeight } from '@/features/toolbar/use-toolbar-height';
import type { LatLon } from '@/lib/geo/types';
import type { MgrsParts } from '@/lib/geo/coords/mgrs';
import { useInteraction } from '@/stores/interaction';
import { useManualEntry } from '@/stores/manual-entry';
import { useMyLocation } from '@/stores/my-location';
import { useToast } from '@/stores/toast';
import { useTheme } from '@/theme/ThemeProvider';

const LANDSCAPE_WIDTH = 520;
const PORTRAIT_MARGIN = 6;
export const POSITION_SET_MESSAGE = 'Position set by hand. You can change it any time in Settings → Location.';

/**
 * Set manually: a box under the toolbar (like quick plot) with the four MGRS fields. Choose on map hides it until a tap
 * (or CTR) picks the spot; it then comes back with that grid, to edit or adjust again. Set saves the position and makes
 * Manual the source.
 */
export function ManualLocationEntry({ landscape }: { landscape: boolean }) {
  const phase = useManualEntry((s) => s.phase);
  const chosen = useManualEntry((s) => s.chosen);
  const start = useManualEntry((s) => s.start);
  if (phase === 'closed') return null;
  const from = chosen ?? start;
  // A newly chosen spot remounts the fields with its grid. While choosing the box stays mounted but hidden, so Cancel
  // brings back exactly what was typed.
  return <EntryBox key={from ? `${from.lat},${from.lon}` : 'none'} landscape={landscape} from={from} hidden={phase === 'choosing'} />;
}

function EntryBox({ landscape, from, hidden }: { landscape: boolean; from: LatLon | null; hidden: boolean }) {
  const toolbar = useToolbarHeight();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { colors } = useTheme();
  const halo = glassHalo(colors);
  const [parts, setParts] = useState<MgrsParts>(() => (from ? mgrsFieldsFor(from) : squareFieldsFor(useInteraction.getState().cameraCenter)));
  const status = evaluateMgrsFields(parts);
  const valid = status.status === 'valid';
  const coord = status.status === 'valid' ? status.coord : null;
  const cardWidth = landscape
    ? Math.min(LANDSCAPE_WIDTH, width - insets.left - insets.right - 2 * EDGE)
    : width - insets.left - insets.right - 2 * PORTRAIT_MARGIN;

  // The valid grid is previewed on the map; editing the fields moves it.
  useEffect(() => {
    useManualEntry.getState().setPending(coord);
  }, [coord?.lat, coord?.lon]); // eslint-disable-line react-hooks/exhaustive-deps -- by value, not identity

  const set = () => {
    if (!coord) return;
    Keyboard.dismiss();
    const { origin, close } = useManualEntry.getState();
    if (!useMyLocation.getState().setManual(coord)) return;
    if (origin === 'map') useToast.getState().show(POSITION_SET_MESSAGE, 'info', { sticky: true });
    close();
  };
  const choose = () => {
    Keyboard.dismiss();
    useManualEntry.getState().startChoosing();
  };

  return (
    <View
      pointerEvents={hidden ? 'none' : 'box-none'}
      className="absolute left-0 right-0 items-center"
      style={{ top: insets.top + EDGE + toolbar + GAP, display: hidden ? 'none' : 'flex' }}>
      <View testID="manual-location-entry" style={{ width: cardWidth }} className="gap-2 rounded-2xl bg-surface-glass p-2">
        <View className="flex-row items-center justify-between px-1">
          <Text style={halo} className="text-xs font-semibold uppercase tracking-widest text-text-muted">
            MY POSITION
          </Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={() => useManualEntry.getState().close()} hitSlop={8} className="active:opacity-60">
            <Icon name="close" size={18} color={colors.text} style={halo} />
          </Pressable>
        </View>
        <MgrsInput value={parts} onChange={setParts} status={status} autoFocus={from ? undefined : parts.square ? 'easting' : 'zone'} nested />
        <View className="flex-row items-center gap-2">
          <View className="flex-1">
            <MenuButton compact glass label={from ? 'Adjust on map' : 'Choose on map'} icon="gesture-tap" onPress={choose} />
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Set"
            accessibilityState={{ disabled: !valid }}
            disabled={!valid}
            onPress={set}
            className={`active:opacity-60 h-10 flex-1 items-center justify-center rounded-lg bg-accent ${valid ? '' : 'opacity-40'}`}>
            <Text className="text-lg font-bold text-on-accent">Set</Text>
          </Pressable>
        </View>
        <Text style={halo} className="px-1 text-xs text-text-muted">
          {from ? 'Edit the grid, or adjust the spot on the map.' : 'Type your grid, or choose your spot on the map.'}
        </Text>
      </View>
    </View>
  );
}
