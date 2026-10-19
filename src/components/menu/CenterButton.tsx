import { CrosshairGlyph } from '@/components/ui/CrosshairGlyph';

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
  return <MenuButton compact={compact} label={label} text="CTR" icon={<CrosshairGlyph size={compact ? 14 : 18} />} onPress={onPress} disabled={disabled} />;
}
