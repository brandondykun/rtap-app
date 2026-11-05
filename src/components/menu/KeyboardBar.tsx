import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { FocusedInputEvents, KeyboardController, KeyboardStickyView, KeyboardToolbar } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/ui/Icon';
import { EDGE, GAP } from '@/features/map/layout';
import { useTheme } from '@/theme/ThemeProvider';

/** The bar's height: the menu panel leaves this much more room above the keyboard. */
export const KEYBOARD_BAR_HEIGHT = 42;
/** Where the pill floats: its gap above the keyboard and from the right edge. Portrait reads tighter at the same values. */
const PLACEMENT = { portrait: { above: GAP, right: EDGE + GAP }, landscape: { above: EDGE, right: EDGE } };

/**
 * Rides on top of the keyboard while any field on the map screen is typed into: previous / next field and Done. The
 * iPhone number pad (MGRS, ranges) has no key that closes it. The arrows stay within the open menu (`KeyboardBarGroup`).
 * Placed once, filling the screen: it pins itself to the bottom, floating just above the keyboard at the right, only as
 * wide as its buttons, so it covers little of the map and the menu. Built from the library's parts, not its toolbar,
 * which is always full width.
 */
export function KeyboardBar({ landscape }: { landscape: boolean }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  // Where the focused field is among its group's fields (the library's internal event, which its own toolbar uses).
  const [focus, setFocus] = useState({ current: 0, count: 0 });
  useEffect(() => {
    const sub = FocusedInputEvents.addListener('focusDidSet', setFocus);
    return () => sub.remove();
  }, []);
  const place = PLACEMENT[landscape ? 'landscape' : 'portrait'];
  const prevDisabled = focus.current <= 0;
  const nextDisabled = focus.current >= focus.count - 1;
  return (
    <KeyboardStickyView
      testID="keyboard-bar"
      // Closed: just below the bottom edge, out of sight.
      offset={{ closed: KEYBOARD_BAR_HEIGHT, opened: -place.above }}
      style={{ position: 'absolute', bottom: 0, right: insets.right + place.right, height: KEYBOARD_BAR_HEIGHT }}>
      {/* The arrows grouped on the left, split by a hairline; Done a filled amber pill set inside the right end. */}
      <View className="h-full flex-row items-center rounded-full border border-border bg-surface-raised p-1">
        <BarArrow icon="chevron-up" label="Previous field" disabled={prevDisabled} onPress={() => KeyboardController.setFocusTo('prev')} color={colors.text} />
        <View className="h-5 w-px bg-border" />
        <BarArrow icon="chevron-down" label="Next field" disabled={nextDisabled} onPress={() => KeyboardController.setFocusTo('next')} color={colors.text} />
        <Pressable accessibilityRole="button" accessibilityLabel="Done" onPress={() => void KeyboardController.dismiss()} hitSlop={4} className="active:opacity-60 ml-2 h-full justify-center rounded-full bg-accent px-4">
          <Text className="text-base font-bold text-on-accent">Done</Text>
        </Pressable>
      </View>
    </KeyboardStickyView>
  );
}

/** Fills the pill's height and centers its chevron there, as Done does its label (a taller button would sit off center). */
function BarArrow({ icon, label, disabled, onPress, color }: { icon: 'chevron-up' | 'chevron-down'; label: string; disabled: boolean; onPress: () => void; color: string }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} hitSlop={4} className={`active:opacity-60 h-full items-center justify-center px-3 ${disabled ? 'opacity-30' : ''}`}>
      <Icon name={icon} size={24} color={color} />
    </Pressable>
  );
}

/** The bar's previous / next go only between the fields inside this (one menu), never to another field on the screen. */
export const KeyboardBarGroup = KeyboardToolbar.Group;
