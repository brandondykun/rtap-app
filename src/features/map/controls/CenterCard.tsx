import { Text, View } from 'react-native';

import { CrosshairGlyph } from '@/components/ui/CrosshairGlyph';
import { useInteraction } from '@/stores/interaction';
import { useSettings } from '@/stores/settings';
import { useTheme } from '@/theme/ThemeProvider';

import { formatCoordinate } from '../interaction/readout';
import { CardLead } from './CardLead';

/** CTR and the crosshair's grid. Positioned by MapControls: over your card in portrait, bottom left in landscape. */
export function CenterCard({ onHeight }: { onHeight?: (height: number) => void }) {
  const { colors } = useTheme();
  const center = useInteraction((s) => s.cameraCenter);
  const coordinateFormat = useSettings((s) => s.coordinateFormat);
  return (
    <View
      testID="center-card"
      onLayout={onHeight ? (e) => onHeight(e.nativeEvent.layout.height) : undefined}
      className="flex-row items-center gap-2 rounded-2xl border border-border bg-surface-chrome px-3 py-2">
      <CardLead icon={<CrosshairGlyph size={14} color={colors['text-muted']} />} tag="CTR" />
      <Text testID="readout-coordinate" className="shrink font-mono-bold text-sm text-text" adjustsFontSizeToFit numberOfLines={1}>
        {center ? formatCoordinate(center, coordinateFormat) : '—'}
      </Text>
    </View>
  );
}
