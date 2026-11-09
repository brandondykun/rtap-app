import { useEffect, useState } from 'react';
import { Pressable, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { PanelFrame } from '@/components/menu/panel-geometry';
import { glassHalo } from '@/components/ui/glass';
import { Icon, type IconName } from '@/components/ui/Icon';
import { tightUnit } from '@/components/ui/unit-gap';
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

/** Portrait: the widest the card grows, on a tablet (every phone is narrower): the width of the map's grid entry cards. */
const PORTRAIT_MAX_WIDTH = 520;

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
 * Bottom card for the temporary point, framed in dark grey: a strip tinted amber as the Average header is
 * orange (TEMP POINT, not saved), the grid with its ground altitude beside it, then Clear and Save sharing a row. Save swaps the
 * header for SAVE TEMP POINT AS with a ✕ (clearing, as Clear does) and the buttons for Unit and Point. Portrait: rendered
 * in the map controls' bar slot (MissionMap), above the grid display and as wide; landscape: flush bottom left, as wide as
 * its content. `panel` is the open menu panel, which the card keeps clear of in landscape.
 */
export function QuickPlotCard({ landscape, panel = null }: { landscape: boolean; panel?: PanelFrame | null }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { colors } = useTheme();
  const temp = useQuickPlot((s) => s.temp);
  const altitudeUnit = useSettings((s) => s.altitudeUnit);
  const altitudeM = useGroundAltitude(temp);
  const clearance = selfCardClearance(useMapChrome((s) => s.selfCard), true);
  // The point Save was pressed for: a new point starts again from Save and Clear.
  const [savingFor, setSavingFor] = useState<LatLon | null>(null);
  if (!temp) return null;
  const saving = savingFor === temp;
  // Landscape: flush bottom left (right of a drawer), beside the readout dock.
  const right = insets.right + EDGE + clearance.right;
  const left = Math.max(insets.left, panel?.side === 'left' ? panel.size : 0) + EDGE;
  const halo = glassHalo(colors);

  const save = (id: 'unit.add' | 'point.add') => {
    useQuickPlot.getState().close();
    useMenu.getState().openMenu(id, { at: temp });
  };
  const clear = () => useQuickPlot.getState().close();

  // Styled as the map's other cards (grid entry, Set manually): 16 pt corners, an 8 pt inset around the buttons and 8 pt
  // buttons (rounded-lg), concentric.
  const card = (
    <View testID="quick-plot-card" style={landscape ? { maxWidth: width - left - right } : { width: '100%', maxWidth: PORTRAIT_MAX_WIDTH }} className="overflow-hidden rounded-2xl border border-border bg-surface-glass">
      {/* The header's text lines up with the grid under it (16 pt in), as on the grid display's Average header. Its
          strip is a shade darker than accent-subtle: see-through amber over near-black. */}
      <View className="border-b border-accent-header-line bg-surface-input">
        <View testID="quick-plot-header" className="min-h-9 flex-row items-center gap-2 bg-accent-header pl-4 pr-2">
          <Icon name={saving ? 'content-save-outline' : 'target'} size={16} color={colors.accent} />
          <Text accessibilityRole="header" numberOfLines={1} className="shrink font-mono-bold text-xs tracking-widest text-accent">
            {saving ? 'SAVE TEMP POINT AS' : 'TEMP POINT'}
          </Text>
          {saving ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Cancel" hitSlop={8} onPress={clear} className="ml-auto h-9 w-9 items-center justify-center active:opacity-60">
              <Icon name="close" size={18} color={colors['text-muted']} />
            </Pressable>
          ) : (
            <Text numberOfLines={1} className="ml-auto pl-2 pr-2 font-mono text-xs text-text-muted">
              not saved
            </Text>
          )}
        </View>
      </View>
      <View className="gap-2 p-2">
        {/* The grid with its ground altitude at the right, a dash until the terrain answers. */}
        <View testID="quick-plot-grid-row" className="flex-row items-baseline gap-3 px-2 pt-1">
          <Text numberOfLines={1} adjustsFontSizeToFit style={halo} className="shrink font-mono-bold text-xl text-text">
            {formatCoordinate(temp, 'mgrs')}
          </Text>
          <Text
            testID="quick-plot-altitude"
            accessibilityLabel={`Altitude ${altitudeM === null ? 'unknown' : formatLength(altitudeM, altitudeUnit)}`}
            numberOfLines={1}
            style={halo}
            className="ml-auto font-mono text-sm text-text-muted">
            {'ALT '}
            <Text className="font-mono-bold text-value-altitude">{tightUnit(formatLength(altitudeM, altitudeUnit), 14)}</Text>
          </Text>
        </View>
        <View testID="quick-plot-card-buttons" className="flex-row gap-2">
          {saving ? (
            <>
              <CardButton label="Unit" icon="rhombus-outline" look="outline" onPress={() => save('unit.add')} />
              <CardButton label="Point" icon="map-marker-outline" look="outline" onPress={() => save('point.add')} />
            </>
          ) : (
            <>
              <CardButton label="Clear" icon="trash-can-outline" look="plain" onPress={clear} />
              <CardButton label="Save" icon="check" look="filled" onPress={() => setSavingFor(temp)} />
            </>
          )}
        </View>
      </View>
    </View>
  );

  if (!landscape) {
    return (
      // Portrait: in the map controls' bar slot, between the zoom buttons and the grid display, across the screen as far
      // in as the grid display (its 8 pt margin); on a tablet no wider than PORTRAIT_MAX_WIDTH, centered.
      <View testID="quick-plot-card-slot" pointerEvents="box-none" className="items-center self-stretch px-2">
        {card}
      </View>
    );
  }
  return (
    <View testID="quick-plot-card-slot" pointerEvents="box-none" className="absolute items-start" style={{ bottom: insets.bottom + EDGE + clearance.lift, left, right }}>
      {card}
    </View>
  );
}

/**
 * Filled amber as Plot and Set, the others as the compact MenuButton (plain, or outlined like an active one). Every label
 * the compact button's size, so buttons side by side read alike; on amber a weight heavier, as dark on amber reads lighter.
 */
const LOOKS = {
  filled: 'bg-accent',
  outline: 'border border-accent bg-accent-subtle',
  plain: 'border border-border bg-surface-raised',
} as const;

/**
 * A card button: filled amber (Save), outlined amber like an active button (Unit, Point), or plain (Clear), sharing its
 * row evenly. 40 pt tall with 8 pt corners, like the buttons on the map's other cards; the label shrinks before it would
 * clip, on the narrowest phones.
 */
function CardButton({ label, icon, look, onPress }: { label: string; icon: IconName; look: keyof typeof LOOKS; onPress: () => void }) {
  const { colors } = useTheme();
  const color = look === 'filled' ? colors['on-accent'] : look === 'outline' ? colors.accent : colors.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      className={`active:opacity-60 h-10 flex-1 flex-row items-center justify-center gap-1.5 rounded-lg px-3 ${LOOKS[look]}`}>
      <Icon name={icon} size={16} color={color} />
      <Text numberOfLines={1} adjustsFontSizeToFit style={{ color }} className={`shrink text-sm ${look === 'filled' ? 'font-bold' : 'font-semibold'}`}>
        {label}
      </Text>
    </Pressable>
  );
}
