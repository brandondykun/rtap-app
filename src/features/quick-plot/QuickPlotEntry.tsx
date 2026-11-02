import { useState } from 'react';
import { Keyboard, Platform, Pressable, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MenuButton } from '@/components/menu/MenuButton';
import { MGRS_ROW_MIN_WIDTH, MgrsInput, MgrsStatusLine } from '@/components/menu/MgrsInput';
import { evaluateMgrsFields, squareFieldsFor } from '@/components/menu/mgrs-fields';
import { CrosshairGlyph } from '@/components/ui/CrosshairGlyph';
import { bannerTop, EDGE } from '@/features/map/layout';
import { useToolbarHeight } from '@/features/toolbar/use-toolbar-height';
import type { MgrsParts } from '@/lib/geo/coords/mgrs';
import { describeVector } from '@/lib/geo/vector';
import { useInteraction } from '@/stores/interaction';
import { usePresence } from '@/stores/presence';
import { useQuickPlot } from '@/stores/quick-plot';
import { useSettings } from '@/stores/settings';
import { useTheme } from '@/theme/ThemeProvider';
import { VALUE_TEXT_CLASS } from '@/theme/value-colors';

const LANDSCAPE_WIDTH = 520;
const PORTRAIT_MARGIN = 6;
/** Cancel and Plot, each, when they share the grid's line. */
const ONE_LINE_ACTION_WIDTH = 104;
/** The card's padding, the grid, Cancel and Plot, and the gaps between them. */
export const ONE_LINE_MIN_WIDTH = 2 * 8 + MGRS_ROW_MIN_WIDTH + 8 + 2 * ONE_LINE_ACTION_WIDTH + 8;
/** Wide enough for roomy digit fields, no wider. */
const ONE_LINE_MAX_WIDTH = 640;

/**
 * Android's landscape keyboard is tall enough to reach the buttons below the grid (and to cover them once the valid
 * line shows), so there Cancel and Plot join the grid's line when it fits, leaving only the valid line below.
 */
function oneLineFits(landscape: boolean, available: number): boolean {
  return landscape && Platform.OS === 'android' && available >= ONE_LINE_MIN_WIDTH;
}

/** Quick plot grid entry: centered under the toolbar (above the keyboard), four MGRS fields, then Cancel and Plot. */
export function QuickPlotEntry({ landscape }: { landscape: boolean }) {
  const toolbar = useToolbarHeight();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { colors } = useTheme();
  // Zone and 100 km square of the crosshair: most quick plots are nearby.
  const [parts, setParts] = useState<MgrsParts>(() => squareFieldsFor(useInteraction.getState().cameraCenter));
  const self = usePresence((s) => s.selfPosition?.position ?? null);
  const angleUnit = useSettings((s) => s.angleUnit);
  const northRef = useSettings((s) => s.northRef);
  const declinationOverrideDeg = useSettings((s) => s.declinationOverrideDeg);
  const status = evaluateMgrsFields(parts);
  const v = status.status === 'valid' && self ? describeVector(self, status.coord, { date: new Date(), declinationOverrideDeg, unit: angleUnit, ref: northRef }) : null;
  // The distance and bearing each in their value color.
  const validDetail = v ? (
    <>
      <Text className={VALUE_TEXT_CLASS.distance}>{v.distanceLabel}</Text>
      {' @ '}
      <Text className={VALUE_TEXT_CLASS.bearing}>{`${v.bearingLabel} ${v.refLabel}`}</Text>
      {' from you'}
    </>
  ) : undefined;
  const available = width - insets.left - insets.right - 2 * EDGE;
  const oneLine = oneLineFits(landscape, available);
  // Portrait uses slimmer side margins than the map's usual edge so the four fields get more room.
  const cardWidth = oneLine
    ? Math.min(ONE_LINE_MAX_WIDTH, available)
    : landscape
      ? Math.min(LANDSCAPE_WIDTH, available)
      : width - insets.left - insets.right - 2 * PORTRAIT_MARGIN;
  const valid = status.status === 'valid';

  const plot = () => {
    if (status.status !== 'valid') return;
    Keyboard.dismiss();
    useQuickPlot.getState().plot(status.coord);
  };
  const close = () => {
    Keyboard.dismiss();
    useQuickPlot.getState().close();
  };

  const grid = (
    <MgrsInput
      value={parts}
      onChange={setParts}
      status={status}
      validDetail={validDetail}
      autoFocus={parts.square ? 'easting' : 'zone'}
      nested
      showStatus={!oneLine}
    />
  );
  const cancelButton = <MenuButton compact label="Cancel" icon="close" onPress={close} />;
  const plotButton = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Plot"
      accessibilityState={{ disabled: !valid }}
      disabled={!valid}
      // Plots as the finger lands, not as it lifts: on iOS, with the keyboard up, the tap can pull focus back to Easting
      // mid-touch, which cancels the press (the first Plot tap did nothing). onPress stays for screen readers, which
      // activate without a touch; plotting twice is harmless (the box has closed by then).
      onPressIn={plot}
      onPress={plot}
      className={`active:opacity-60 h-10 flex-1 flex-row items-center justify-center gap-2 rounded-lg bg-accent ${valid ? '' : 'opacity-70'}`}>
      {/* On the amber button an amber dot would vanish: one dark color for the whole crosshair. */}
      <CrosshairGlyph size={20} color={colors['on-accent']} dotColor={colors['on-accent']} />
      <Text className="text-lg font-bold text-on-accent">Plot</Text>
    </Pressable>
  );

  const actions = (
    <View testID="quick-plot-actions" style={oneLine ? { width: 2 * ONE_LINE_ACTION_WIDTH + 8 } : undefined} className="flex-row items-center gap-2">
      <View className="flex-1">{cancelButton}</View>
      {plotButton}
    </View>
  );

  return (
    // Below the Mapbox logo row, which must stay visible (in landscape the logo is beside the toolbar: right under it).
    <View testID="quick-plot-frame" pointerEvents="box-none" className="absolute left-0 right-0 items-center" style={{ top: insets.top + bannerTop(landscape, toolbar) }}>
      {/* 16 pt corners less 8 pt padding are the fields' and Plot's 8 pt (rounded-lg): concentric. */}
      <View testID="quick-plot-entry" style={{ width: cardWidth }} className="gap-2 rounded-2xl bg-surface-glass p-2">
        {/* Cancel and Plot side by side below the grid, like the MY POSITION box, or on the grid's line with the valid
            line below. The grid keeps its place either way, so turning the phone never remounts it. */}
        <View testID="quick-plot-row" className={`flex-row gap-2 ${oneLine ? 'items-center' : 'items-start'}`}>
          <View className="flex-1">{grid}</View>
          {oneLine ? actions : null}
        </View>
        {oneLine ? <MgrsStatusLine status={status} validDetail={validDetail} /> : actions}
      </View>
    </View>
  );
}
