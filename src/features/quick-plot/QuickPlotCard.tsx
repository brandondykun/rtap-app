import { useEffect, useState } from 'react';
import { Pressable, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MenuButton } from '@/components/menu/MenuButton';
import type { PanelFrame } from '@/components/menu/panel-geometry';
import { glassHalo } from '@/components/ui/glass';
import { Icon } from '@/components/ui/Icon';
import { formatLength } from '@/features/location/gps-format';
import { formatCoordinate } from '@/features/map/interaction/readout';
import { EDGE, selfCardClearance } from '@/features/map/layout';
import { elevationAt } from '@/features/map/terrain/elevation';
import type { LatLon } from '@/lib/geo/types';
import { useMapChrome } from '@/stores/map-chrome';
import { useMenu } from '@/stores/menu';
import { useQuickPlot } from '@/stores/quick-plot';
import { useSettings } from '@/stores/settings';
import { useTheme } from '@/theme/ThemeProvider';

/** Ground altitude lookups after a plot: once the map has eased there (its terrain loads), then once more if none came. */
const ALTITUDE_LOOKUPS_MS = [400, 1500];

/** The ground altitude at `at` (m), looked up from the map's terrain; null until known (or when there is none). */
function useGroundAltitude(at: LatLon | null): number | null {
  const [found, setFound] = useState<{ at: LatLon; m: number } | null>(null);
  useEffect(() => {
    if (!at) return;
    let done = false;
    const timers = ALTITUDE_LOOKUPS_MS.map((ms) =>
      setTimeout(async () => {
        if (done) return;
        const m = await elevationAt(at);
        if (m === null || done) return;
        done = true;
        setFound({ at, m });
      }, ms),
    );
    return () => {
      done = true;
      timers.forEach(clearTimeout);
    };
  }, [at]);
  return found && at && found.at === at ? found.m : null;
}

/**
 * Bottom card for the temporary point: TEMP + grid on its own line with its ground altitude under it, then Save unit, Save
 * point and Discard, as wide as its content. `panel` is the open menu panel, which the card keeps clear of in landscape.
 */
export function QuickPlotCard({ landscape, panel = null }: { landscape: boolean; panel?: PanelFrame | null }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { colors } = useTheme();
  const temp = useQuickPlot((s) => s.temp);
  const altitudeUnit = useSettings((s) => s.altitudeUnit);
  const altitudeM = useGroundAltitude(temp);
  const clearance = selfCardClearance(useMapChrome((s) => s.selfCard), landscape);
  if (!temp) return null;
  // Landscape: flush bottom left (right of a drawer), beside the readout dock.
  // Portrait: centered on the screen above your card, as far in from the left as the zoom column keeps it from the right.
  const right = insets.right + EDGE + clearance.right;
  const left = landscape ? Math.max(insets.left, panel?.side === 'left' ? panel.size : 0) + EDGE : insets.left + EDGE + clearance.right;
  const available = width - left - right;

  const save = (id: 'unit.add' | 'point.add') => {
    useQuickPlot.getState().close();
    useMenu.getState().openMenu(id, { at: temp });
  };

  // Under the grid, lined up with it: the ground altitude there, a dash until the terrain answers.
  const altitude = (
    <Text
      testID="quick-plot-altitude"
      accessibilityLabel={`Altitude ${altitudeM === null ? 'unknown' : formatLength(altitudeM, altitudeUnit)}`}
      style={glassHalo(colors)}
      className="font-mono text-base text-value-altitude">
      {`ALT ${formatLength(altitudeM, altitudeUnit)}`}
    </Text>
  );
  const grid = (
    <View className="flex-row items-center gap-3 px-1 pt-0.5">
      <View className="rounded-md border border-accent px-2 py-0.5">
        <Text style={glassHalo(colors)} className="text-xs font-bold tracking-widest text-accent">
          TEMP
        </Text>
      </View>
      <View className="shrink">
        <Text numberOfLines={1} adjustsFontSizeToFit style={glassHalo(colors)} className="font-mono text-xl font-semibold text-text">
          {formatCoordinate(temp, 'mgrs')}
        </Text>
        {altitude}
      </View>
    </View>
  );
  const discard = <MenuButton label="Discard" icon="trash-can-outline" iconOnly onPress={() => useQuickPlot.getState().close()} />;
  const saveUnit = <MenuButton label="Save unit" icon="rhombus-outline" active onPress={() => save('unit.add')} />;
  const savePoint = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Save point"
      onPress={() => save('point.add')}
      // Sized like a regular MenuButton, beside Save unit and Discard.
      className="active:opacity-60 flex-row items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3">
      <Icon name="map-marker-outline" size={18} color={colors['on-accent']} />
      <Text style={{ color: colors['on-accent'] }} className="font-semibold">
        Save point
      </Text>
    </Pressable>
  );

  return (
    <View testID="quick-plot-card-slot" pointerEvents="box-none" className={`absolute ${landscape ? 'items-start' : 'items-center'}`} style={{ bottom: insets.bottom + EDGE + clearance.lift, left, right }}>
      {/* 20 pt corners less the 1 pt border and 7 pt padding are the buttons' 12 pt (rounded-xl): concentric. */}
      <View testID="quick-plot-card" style={{ maxWidth: available }} className="gap-2 rounded-[20px] border border-accent bg-surface-glass p-[7px]">
        {grid}
        <View testID="quick-plot-card-buttons" className="flex-row gap-1.5">
          {/* Each button only as wide as its label, to cover less of the map. */}
          <View>{saveUnit}</View>
          <View>{savePoint}</View>
          <View>{discard}</View>
        </View>
      </View>
    </View>
  );
}
