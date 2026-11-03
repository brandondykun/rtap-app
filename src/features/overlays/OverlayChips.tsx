import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

import type { Overlay } from './repository';

/**
 * A wrapping row of overlay chips, each turned on or off by a tap: in Layers, whether the overlay shows; in an item's
 * view, whether the item is in it. On is outlined and filled in amber, like the chosen tab. `trailing` ends the row
 * (Layers' button to manage the overlays).
 */
export function OverlayChips({
  overlays,
  isOn,
  onToggle,
  label,
  trailing,
  testID,
}: {
  overlays: readonly Overlay[];
  isOn: (overlay: Overlay) => boolean;
  onToggle: (overlay: Overlay) => void;
  /** Each chip's screen-reader name, e.g. "Show Phase 1". */
  label: (overlay: Overlay) => string;
  trailing?: ReactNode;
  testID?: string;
}) {
  return (
    <View testID={testID} className="flex-row flex-wrap items-center gap-1.5">
      {overlays.map((o) => {
        const on = isOn(o);
        return (
          <Pressable
            key={o.id}
            testID={`overlay-chip-${o.id}`}
            accessibilityRole="button"
            accessibilityLabel={label(o)}
            accessibilityState={{ selected: on }}
            onPress={() => onToggle(o)}
            hitSlop={{ top: 4, bottom: 4 }}
            className={`h-9 max-w-full justify-center rounded-full border px-3 active:opacity-60 ${on ? 'border-accent bg-accent-subtle' : 'border-border'}`}>
            <Text numberOfLines={1} className={`text-sm font-semibold ${on ? 'text-accent' : 'text-text-muted'}`}>
              {o.name}
            </Text>
          </Pressable>
        );
      })}
      {trailing}
    </View>
  );
}
