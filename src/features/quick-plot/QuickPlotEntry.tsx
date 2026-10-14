import { useState } from 'react';
import { Keyboard, Pressable, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MgrsInput } from '@/components/menu/MgrsInput';
import { EMPTY_MGRS, evaluateMgrsFields, mgrsFieldsFor } from '@/components/menu/mgrs-fields';
import { CrosshairGlyph } from '@/components/ui/CrosshairGlyph';
import { MapButton } from '@/features/map/controls/MapButton';
import { EDGE, GAP, TOOLBAR_HEIGHT } from '@/features/map/layout';
import type { MgrsParts } from '@/lib/geo/coords/mgrs';
import { describeVector } from '@/lib/geo/vector';
import { useInteraction } from '@/stores/interaction';
import { usePresence } from '@/stores/presence';
import { useQuickPlot } from '@/stores/quick-plot';
import { useSettings } from '@/stores/settings';
import { useTheme } from '@/theme/ThemeProvider';

const LANDSCAPE_WIDTH = 520;
const PORTRAIT_MARGIN = 6;

/** Zone and 100 km square of the crosshair (most quick plots are nearby); empty before the map has a center. */
function prefill(): MgrsParts {
  const center = useInteraction.getState().cameraCenter;
  if (!center) return EMPTY_MGRS;
  const f = mgrsFieldsFor(center);
  return { ...EMPTY_MGRS, zoneBand: f.zoneBand, square: f.square };
}

/** Quick plot grid entry: centered under the toolbar (above the keyboard), four MGRS fields and Plot. */
export function QuickPlotEntry({ landscape }: { landscape: boolean }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { colors } = useTheme();
  const [parts, setParts] = useState<MgrsParts>(prefill);
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
      className={`h-12 flex-row items-center justify-center gap-2 rounded-xl bg-accent ${landscape ? 'px-4' : ''} ${valid ? '' : 'opacity-40'}`}>
      <CrosshairGlyph size={20} color={colors['on-accent']} />
      <Text className="text-lg font-bold text-on-accent">Plot</Text>
    </Pressable>
  );

  return (
    <View pointerEvents="box-none" className="absolute left-0 right-0 items-center" style={{ top: insets.top + EDGE + TOOLBAR_HEIGHT + GAP }}>
      <View testID="quick-plot-entry" style={{ width: cardWidth }} className="gap-2 rounded-2xl border border-border bg-surface-chrome p-3">
        <View testID="quick-plot-row" className="flex-row items-start gap-1">
          <View className="flex-1">
            <MgrsInput
              key={generation}
              value={parts}
              onChange={setParts}
              status={status}
              validDetail={validDetail}
              autoFocus={generation === 0 && parts.square ? 'easting' : 'zone'}
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
