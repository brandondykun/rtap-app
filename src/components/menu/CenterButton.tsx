import { CrosshairGlyph } from '@/components/ui/CrosshairGlyph';
import { useTheme } from '@/theme/ThemeProvider';

import { MenuButton } from './MenuButton';

/** The standard button for acting at the crosshair: the crosshair glyph and CTR. `label` is what a screen reader hears. */
export function CenterButton({
  label = 'Add at center',
  onPress,
  compact = false,
  disabled = false,
}: {
  label?: string;
  onPress: () => void;
  compact?: boolean;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  return <MenuButton compact={compact} label={label} text="CTR" icon={<CrosshairGlyph size={compact ? 14 : 18} color={colors.text} />} onPress={onPress} disabled={disabled} />;
}
