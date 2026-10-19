import { CenterButton } from '@/components/menu/CenterButton';
import { MenuButton } from '@/components/menu/MenuButton';
import { CrosshairGlyph } from '@/components/ui/CrosshairGlyph';
import { useDraft } from '@/stores/draft';
import { useInteraction } from '@/stores/interaction';
import { useTheme } from '@/theme/ThemeProvider';

import { MapHintBar } from './MapHintBar';

/** While drawing a line or polygon: CTR (add at center) or Move to CTR, and Undo/Done; for a circle, Set center / Set edge at CTR. */
export function LineDrawBar() {
  const { colors } = useTheme();
  const selected = useDraft((s) => s.selectedVertex);
  const insertAfter = useDraft((s) => s.insertAfter);
  const canUndo = useDraft((s) => s.history.length > 0);
  const moving = selected !== null && insertAfter === null;
  const circle = useDraft((s) => s.category === 'polygon' && s.polygonShape === 'circle');
  const hasCenter = useDraft((s) => s.coord !== null);

  const atCenter = () => {
    const center = useInteraction.getState().cameraCenter;
    if (!center) return;
    const d = useDraft.getState();
    if (circle) {
      if (d.coord === null) d.setCoord(center, 'crosshair');
      else d.setCircleEdge(center);
    } else if (moving) d.moveVertex(selected!, center);
    else d.addVertex(center);
  };
  // Visible text says CTR; the label spells it out for screen readers.
  const [centerLabel, centerText] = circle
    ? hasCenter
      ? ['Set edge at crosshair', 'Set edge at CTR']
      : ['Set center at crosshair', 'Set center at CTR']
    : moving
      ? ['Move to center', 'Move to CTR']
      : ['Add at center', 'CTR'];

  return (
    <MapHintBar testID="line-draw-bar" hint="Tap map">
      {centerLabel === 'Add at center' ? (
        <CenterButton compact onPress={atCenter} />
      ) : (
        <MenuButton compact label={centerLabel} text={centerText} icon={<CrosshairGlyph size={14} color={colors.text} />} onPress={atCenter} />
      )}
      {circle ? null : moving ? (
        <MenuButton compact label="Done" icon="check" onPress={() => useDraft.getState().selectVertex(null)} />
      ) : (
        <MenuButton compact label="Undo" icon="undo" iconOnly onPress={() => useDraft.getState().undo()} disabled={!canUndo} />
      )}
    </MapHintBar>
  );
}
