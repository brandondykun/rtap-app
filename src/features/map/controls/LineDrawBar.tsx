import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MenuButton } from '@/components/menu/MenuButton';
import type { PanelFrame } from '@/components/menu/panel-geometry';
import { CrosshairGlyph } from '@/components/ui/CrosshairGlyph';
import { Icon } from '@/components/ui/Icon';
import { useDraft } from '@/stores/draft';
import { useInteraction } from '@/stores/interaction';
import { useTheme } from '@/theme/ThemeProvider';

import { CONTROL_SIZE, EDGE, GAP } from '../layout';

/** While drawing a line: what the next map tap does, plus Add/Move at center and Undo/Done. */
export function LineDrawBar({ panel }: { panel: PanelFrame | null }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const count = useDraft((s) => s.vertices.length);
  const selected = useDraft((s) => s.selectedVertex);
  const insertAfter = useDraft((s) => s.insertAfter);
  const canUndo = useDraft((s) => s.history.length > 0);
  const moving = selected !== null && insertAfter === null;
  const prompt = moving ? `Tap map to move point ${selected! + 1}` : insertAfter !== null ? `Tap map to insert point ${insertAfter + 2}` : `Tap map to add point ${count + 1}`;

  const atCenter = () => {
    const center = useInteraction.getState().cameraCenter;
    if (!center) return;
    if (moving) useDraft.getState().moveVertex(selected!, center);
    else useDraft.getState().addVertex(center);
  };

  return (
    <View
      testID="line-draw-bar"
      className="absolute flex-row items-center gap-2 rounded-2xl border border-accent bg-surface-chrome p-2"
      style={{
        bottom: (panel?.side === 'bottom' ? panel.size : insets.bottom) + EDGE,
        left: (panel?.side === 'left' ? panel.size : insets.left) + EDGE,
        right: insets.right + EDGE + CONTROL_SIZE + GAP,
      }}>
      <Icon name="gesture-tap" size={20} color={colors.accent} />
      <Text numberOfLines={1} className="shrink text-sm text-text">
        {prompt}
      </Text>
      <View className="ml-auto flex-row gap-2">
        <MenuButton label={moving ? 'Move to center' : 'Add at center'} icon={<CrosshairGlyph size={16} color={colors.text} />} onPress={atCenter} />
        {moving ? (
          <MenuButton label="Done" icon="check" onPress={() => useDraft.getState().selectVertex(null)} />
        ) : (
          <MenuButton label="Undo" icon="undo" iconOnly onPress={() => useDraft.getState().undo()} disabled={!canUndo} />
        )}
      </View>
    </View>
  );
}
