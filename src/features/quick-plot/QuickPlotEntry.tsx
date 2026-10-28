import { useState } from 'react';
import { Keyboard, Pressable, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MgrsInput } from '@/components/menu/MgrsInput';
import { EMPTY_MGRS, evaluateMgrsFields, squareFieldsFor } from '@/components/menu/mgrs-fields';
import { CrosshairGlyph } from '@/components/ui/CrosshairGlyph';
import { MapButton } from '@/features/map/controls/MapButton';
import { bannerTop, EDGE } from '@/features/map/layout';
import { useToolbarHeight } from '@/features/toolbar/use-toolbar-height';
import type { MgrsParts } from '@/lib/geo/coords/mgrs';
import { describeVector } from '@/lib/geo/vector';
import { useInteraction } from '@/stores/interaction';
import { usePresence } from '@/stores/presence';
import { useQuickPlot } from '@/stores/quick-plot';
import { useSettings } from '@/stores/settings';
import { useTheme } from '@/theme/ThemeProvider';

const LANDSCAPE_WIDTH = 520;
const PORTRAIT_MARGIN = 6;

/** Quick plot grid entry: centered under the toolbar (above the keyboard), four MGRS fields and Plot. */
export function QuickPlotEntry({ landscape }: { landscape: boolean }) {
  const toolbar = useToolbarHeight();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { colors } = useTheme();
  // Zone and 100 km square of the crosshair: most quick plots are nearby.
  const [parts, setParts] = useState<MgrsParts>(() => squareFieldsFor(useInteraction.getState().cameraCenter));
  // Bumped by Clear: remounts the fields so Zone takes focus.
  const [generation, setGeneration] = useState(0);
  const self = usePresence((s) => s.selfPosition?.position ?? null);
  const angleUnit = useSettings((s) => s.angleUnit);
  const northRef = useSettings((s) => s.northRef);
  const declinationOverrideDeg = useSettings((s) => s.declinationOverrideDeg);
  const status = evaluateMgrsFields(parts);
  const v = status.status === 'valid' && self ? describeVector(self, status.coord, { date: new Date(), declinationOverrideDeg, unit: angleUnit, ref: northRef }) : null;
  const validDetail = v ? `${v.distanceLabel} @ ${v.bearingLabel} ${v.refLabel} from you` : undefined;
  // Portrait uses slimmer side margins than the map's usual edge so the four fields get more room.
  const cardWidth = landscape
    ? Math.min(LANDSCAPE_WIDTH, width - insets.left - insets.right - 2 * EDGE)
    : width - insets.left - insets.right - 2 * PORTRAIT_MARGIN;
  const valid = status.status === 'valid';

  const plot = () => {
    if (status.status !== 'valid') return;
    Keyboard.dismiss();
    useQuickPlot.getState().plot(status.coord);
  };
  const clear = () => {
    setParts(EMPTY_MGRS);
    setGeneration((g) => g + 1);
  };

  const clearButton = <MapButton grouped label="Clear grid" icon="close-circle-outline" onPress={clear} />;
  const plotButton = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Plot"
      accessibilityState={{ disabled: !valid }}
      disabled={!valid}
      onPress={plot}
      className={`active:opacity-60 h-12 flex-row items-center justify-center gap-2 rounded-lg bg-accent ${landscape ? 'ml-2 px-4' : ''} ${valid ? '' : 'opacity-40'}`}>
      {/* On the amber button an amber dot would vanish: one dark color for the whole crosshair. */}
      <CrosshairGlyph size={20} color={colors['on-accent']} dotColor={colors['on-accent']} />
      <Text className="text-lg font-bold text-on-accent">Plot</Text>
    </Pressable>
  );

  return (
    // Below the Mapbox logo row, which must stay visible (in landscape the logo is beside the toolbar: right under it).
    <View testID="quick-plot-frame" pointerEvents="box-none" className="absolute left-0 right-0 items-center" style={{ top: insets.top + bannerTop(landscape, toolbar) }}>
      {/* 16 pt corners less 8 pt padding are the fields' and Plot's 8 pt (rounded-lg): concentric. */}
      <View testID="quick-plot-entry" style={{ width: cardWidth }} className="gap-2 rounded-2xl bg-surface-glass p-2">
        <View testID="quick-plot-row" className="flex-row items-start gap-1">
          <View className="flex-1">
            <MgrsInput
              key={generation}
              value={parts}
              onChange={setParts}
              status={status}
              validDetail={validDetail}
              autoFocus={generation === 0 && parts.square ? 'easting' : 'zone'}
              nested
            />
          </View>
          {/* Landscape: Plot (then Clear) beside the fields, above the tall keyboard. */}
          {landscape ? plotButton : null}
          {landscape ? clearButton : null}
        </View>
        {landscape ? null : (
          <View className="flex-row items-center gap-1">
            <View className="flex-1">{plotButton}</View>
            {clearButton}
          </View>
        )}
      </View>
    </View>
  );
}
