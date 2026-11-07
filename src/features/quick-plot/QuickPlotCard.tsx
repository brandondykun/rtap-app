import { useEffect, useState } from 'react';
import { Pressable, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { PanelFrame } from '@/components/menu/panel-geometry';
import { glassHalo } from '@/components/ui/glass';
import { Icon, type IconName } from '@/components/ui/Icon';
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

/** The card's border and padding, either side: what its buttons have less than its width. */
const CARD_INSET = 2 * (1 + 7);

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
 * Bottom card for the temporary point: TEMP and the grid with its ground altitude under it, then Clear and Save sharing a
 * row. Save swaps the card for just Save unit, Save point and Cancel (clearing, as Clear does): on one line when they fit
 * (always in landscape), Cancel at the far right; otherwise the saves above Cancel. As wide as its content. `panel` is the open menu panel, which the card keeps
 * clear of in landscape.
 */
export function QuickPlotCard({ landscape, panel = null }: { landscape: boolean; panel?: PanelFrame | null }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { colors } = useTheme();
  const temp = useQuickPlot((s) => s.temp);
  const altitudeUnit = useSettings((s) => s.altitudeUnit);
  const altitudeM = useGroundAltitude(temp);
  const clearance = selfCardClearance(useMapChrome((s) => s.selfCard), landscape);
  // The point Save was pressed for: a new point starts again from Save and Clear.
  const [savingFor, setSavingFor] = useState<LatLon | null>(null);
  // Portrait: how wide the three buttons are on one line, measured unseen (0 until then).
  const [lineWidth, setLineWidth] = useState(0);
  if (!temp) return null;
  const saving = savingFor === temp;
  // Landscape: flush bottom left (right of a drawer), beside the readout dock.
  // Portrait: centered on the screen above your card, as far in from the left as the zoom column keeps it from the right.
  const right = insets.right + EDGE + clearance.right;
  const left = landscape ? Math.max(insets.left, panel?.side === 'left' ? panel.size : 0) + EDGE : insets.left + EDGE + clearance.right;
  const available = width - left - right;
  const oneLine = landscape || (lineWidth > 0 && lineWidth <= available - CARD_INSET);
  // Portrait, the card waits unseen for the measure, so it does not show one layout and then the other.
  const measuring = saving && !landscape && lineWidth === 0;

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
  const clear = () => useQuickPlot.getState().close();
  const saveButtons = (fill: CardFill) => (
    <>
      <CardButton label="Save unit" icon="rhombus-outline" look="outline" fill={fill} onPress={() => save('unit.add')} />
      <CardButton label="Save point" icon="map-marker-outline" look="filled" fill={fill} onPress={() => save('point.add')} />
    </>
  );
  const cancel = (fill: CardFill) => <CardButton label="Cancel" icon="close" look="plain" fill={fill} onPress={clear} />;
  // Left to right: TEMP, then the grid with its altitude under it, as far in from the right as TEMP is from the left.
  const header = (
    <View testID="quick-plot-header" className="flex-row items-center gap-3 px-2">
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

  return (
    <View testID="quick-plot-card-slot" pointerEvents="box-none" className={`absolute ${landscape ? 'items-start' : 'items-center'}`} style={{ bottom: insets.bottom + EDGE + clearance.lift, left, right }}>
      {/* Styled as the map's other cards (grid entry, Set manually): 16 pt corners, an 8 pt inset (here the amber
          border's 1 pt and 7 pt padding) and 8 pt buttons (rounded-lg), concentric. */}
      <View testID="quick-plot-card" style={[{ maxWidth: available }, measuring ? { opacity: 0 } : null]} className="gap-2 rounded-2xl border border-accent bg-surface-glass p-[7px]">
        {saving ? null : header}
        {/* The buttons share the card's width, under the grid. */}
        {/* Each button grows from its label's width and holds one line of text, so every button is as tall. Not a
            wrapping row: one sized itself for a second line it never used, leaving a gap under the buttons. */}
        {saving && oneLine ? (
          <View testID="quick-plot-card-buttons" className="flex-row gap-2">
            {saveButtons('grow')}
            {cancel('grow')}
          </View>
        ) : saving ? (
          <View testID="quick-plot-card-buttons" className="gap-2">
            <View testID="quick-plot-card-saves" className="flex-row gap-2">
              {saveButtons('grow')}
            </View>
            {/* Stretched across the card, not grown: alone in a column, growing made it tall. */}
            {cancel('none')}
          </View>
        ) : (
          <View testID="quick-plot-card-buttons" className="flex-row gap-2">
            <CardButton label="Clear" icon="trash-can-outline" look="plain" onPress={clear} />
            <CardButton label="Save" icon="content-save-outline" look="filled" onPress={() => setSavingFor(temp)} />
          </View>
        )}
      </View>
      {saving && !landscape ? (
        // The three on one line at their labels' width, unseen and untouchable, to see whether that line fits.
        <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ position: 'absolute', top: 0, left: 0, width: 10_000, opacity: 0 }}>
          <View testID="quick-plot-card-measure" className="flex-row gap-2 self-start" onLayout={(e) => setLineWidth(e.nativeEvent.layout.width)}>
            {saveButtons('none')}
            {cancel('none')}
          </View>
        </View>
      ) : null}
    </View>
  );
}

/** `share` splits a row evenly whatever the labels; `grow` starts from the label's width; `none` keeps to it. */
type CardFill = 'share' | 'grow' | 'none';

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
 * A card button: filled amber (Save, Save point), outlined amber like an active button (Save unit), or plain (Clear,
 * Cancel), filling its row as `fill` says (CardFill). 40 pt tall with 8 pt corners, like the buttons on the map's other
 * cards, so each is as tall as its neighbors; the label shrinks before it would clip, on the narrowest phones.
 */
function CardButton({ label, icon, look, fill = 'share', onPress }: { label: string; icon: IconName; look: keyof typeof LOOKS; fill?: CardFill; onPress: () => void }) {
  const { colors } = useTheme();
  const color = look === 'filled' ? colors['on-accent'] : look === 'outline' ? colors.accent : colors.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      className={`active:opacity-60 ${fill === 'share' ? 'flex-1' : fill === 'grow' ? 'grow' : ''} h-10 flex-row items-center justify-center gap-1.5 rounded-lg px-3 ${LOOKS[look]}`}>
      <Icon name={icon} size={16} color={color} />
      <Text numberOfLines={1} adjustsFontSizeToFit style={{ color }} className={`shrink text-sm ${look === 'filled' ? 'font-bold' : 'font-semibold'}`}>
        {label}
      </Text>
    </Pressable>
  );
}
