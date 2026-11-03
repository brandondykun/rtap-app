import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

import { SEGMENTED_HIGHLIGHT_RADIUS, SEGMENTED_RADIUS } from '@/components/menu/MenuSegmented';
import { Icon } from '@/components/ui/Icon';
import { useLayersView } from '@/stores/layers-view';
import { useTheme } from '@/theme/ThemeProvider';

import type { Overlay } from './repository';

const count = (n: number) => n.toLocaleString('en-US');

/**
 * Layers' Overlays section: one line saying how many overlays are on, which opens to a tile per overlay (Base first) in
 * two columns. A tap on a tile turns the overlay on or off; the dashed last tile manages them. Open or closed is kept
 * while the app runs.
 */
export function LayersOverlaysSection({
  overlays,
  onToggle,
  onManage,
}: {
  /** Base first, then the mission's overlays. */
  overlays: readonly Overlay[];
  onToggle: (overlay: Overlay) => void;
  onManage: () => void;
}) {
  const { colors } = useTheme();
  const open = useLayersView((s) => s.overlaysOpen);
  const on = overlays.filter((o) => !o.hidden).length;
  // Base alone: nothing to manage yet but adding one.
  const anyNamed = overlays.length > 1;
  const tiles = [
    ...overlays.map((o) => <OverlayTile key={o.id} overlay={o} onPress={() => onToggle(o)} />),
    <Pressable
      key="manage"
      accessibilityRole="button"
      accessibilityLabel="Manage overlays"
      onPress={onManage}
      className="h-11 flex-1 flex-row items-center gap-2 border border-dashed border-border px-3 active:opacity-60"
      style={{ borderRadius: SEGMENTED_HIGHLIGHT_RADIUS }}>
      <Icon name={anyNamed ? 'pencil-outline' : 'plus'} size={18} color={colors['text-muted']} />
      <Text numberOfLines={1} className="flex-1 text-base font-semibold text-text">
        {anyNamed ? 'Overlays' : 'Add overlay'}
      </Text>
    </Pressable>,
  ];
  // Two to a row; an odd last tile keeps its half width.
  const rows: ReactNode[][] = [];
  for (let i = 0; i < tiles.length; i += 2) rows.push(tiles.slice(i, i + 2));

  return (
    <View testID="layers-overlays-section" className="border border-border bg-surface-input" style={{ borderRadius: SEGMENTED_RADIUS }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Overlays, ${count(on)} of ${count(overlays.length)} on`}
        accessibilityState={{ expanded: open }}
        onPress={() => useLayersView.getState().setOverlaysOpen(!open)}
        className="h-12 flex-row items-center gap-2.5 px-4 active:opacity-60">
        <Icon name="layers-outline" size={18} color={colors.accent} />
        <Text className="text-xs font-semibold uppercase tracking-widest text-text">Overlays</Text>
        <Text testID="layers-overlays-summary" className="mr-auto font-mono-bold text-sm text-accent">
          {`${count(on)}/${count(overlays.length)} on`}
        </Text>
        <Icon name={open ? 'chevron-up' : 'chevron-down'} size={22} color={colors['text-muted']} />
      </Pressable>
      {open ? (
        <View testID="layers-overlays" className="gap-2 px-3 pb-3">
          {rows.map((row, i) => (
            <View key={i} className="flex-row gap-2">
              {row}
              {row.length === 1 ? <View className="flex-1" /> : null}
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

/** One overlay: its eye, name and item count; on is outlined and filled in amber, like the chosen tab. */
function OverlayTile({ overlay, onPress }: { overlay: Overlay; onPress: () => void }) {
  const { colors } = useTheme();
  const on = !overlay.hidden;
  return (
    <Pressable
      testID={`overlay-chip-${overlay.id}`}
      accessibilityRole="button"
      accessibilityLabel={on ? `Hide ${overlay.name}` : `Show ${overlay.name}`}
      accessibilityState={{ selected: on }}
      onPress={onPress}
      className={`h-11 flex-1 flex-row items-center gap-2 border px-3 active:opacity-60 ${on ? 'border-accent bg-accent-subtle' : 'border-border'}`}
      // Rounded like the chosen tab's highlight, inside a box rounded like the tabs.
      style={{ borderRadius: SEGMENTED_HIGHLIGHT_RADIUS }}>
      <Icon name={on ? 'eye-outline' : 'eye-off-outline'} size={18} color={on ? colors.accent : colors['text-muted']} />
      <Text numberOfLines={1} className={`flex-1 text-base font-semibold ${on ? 'text-accent' : 'text-text-muted'}`}>
        {overlay.name}
      </Text>
      <Text className={`font-mono text-sm ${on ? 'text-accent' : 'text-text-muted'}`}>{count(overlay.itemCount)}</Text>
    </Pressable>
  );
}
