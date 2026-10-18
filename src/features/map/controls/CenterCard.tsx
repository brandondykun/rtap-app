import { Text, View } from 'react-native';

import { CrosshairGlyph } from '@/components/ui/CrosshairGlyph';
import { useInteraction } from '@/stores/interaction';
import { useSettings } from '@/stores/settings';
import { useTheme } from '@/theme/ThemeProvider';

import { formatCoordinate } from '../interaction/readout';
import { CardLead } from './CardLead';

/** CTR and the crosshair's grid. Positioned by MapBottomLeft. */
export function CenterCard() {
  const { colors } = useTheme();
  const center = useInteraction((s) => s.cameraCenter);
  const coordinateFormat = useSettings((s) => s.coordinateFormat);
  return (
    <View testID="center-card" className="flex-row items-center gap-2 self-start rounded-2xl border border-border bg-surface-chrome px-3 py-2">
      <CardLead icon={<CrosshairGlyph size={14} color={colors['text-muted']} />} tag="CTR" />
      <Text testID="readout-coordinate" className="shrink font-mono-bold text-sm text-text" adjustsFontSizeToFit numberOfLines={1}>
        {center ? formatCoordinate(center, coordinateFormat) : '—'}
      </Text>
    </View>
  );
}
