import { MenuButton } from '@/components/menu/MenuButton';
import { CrosshairGlyph } from '@/components/ui/CrosshairGlyph';
import { useDraft } from '@/stores/draft';
import { useInteraction } from '@/stores/interaction';
import { useTheme } from '@/theme/ThemeProvider';

import { MapHintBar } from './MapHintBar';

/** While drawing a line or polygon: Add/Move at center and Undo/Done; for a circle, Set center / Set edge at the crosshair. */
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
  const centerLabel = circle ? (hasCenter ? 'Set edge at crosshair' : 'Set center at crosshair') : moving ? 'Move to center' : 'Add at center';

  return (
    <MapHintBar testID="line-draw-bar" hint="Tap map">
      <MenuButton compact label={centerLabel} icon={<CrosshairGlyph size={14} color={colors.text} />} onPress={atCenter} />
      {circle ? null : moving ? (
        <MenuButton compact label="Done" icon="check" onPress={() => useDraft.getState().selectVertex(null)} />
      ) : (
        <MenuButton compact label="Undo" icon="undo" iconOnly onPress={() => useDraft.getState().undo()} disabled={!canUndo} />
      )}
    </MapHintBar>
  );
}
