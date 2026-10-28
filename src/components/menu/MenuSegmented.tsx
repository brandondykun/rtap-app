import { useState, type ReactNode } from 'react';
import { Pressable, View, type LayoutRectangle } from 'react-native';
import Animated, { ReduceMotion, useAnimatedStyle, withSpring } from 'react-native-reanimated';

import { useTheme } from '@/theme/ThemeProvider';

type Option<T extends string> = { value: T; label: string; icon?: ReactNode; disabled?: boolean };

/**
 * The highlight glides across the control on a spring that settles without overshoot (a quick tap mid-slide turns it
 * smoothly instead of restarting). With Reduce Motion on it jumps instead.
 */
export const SLIDE = { duration: 350, dampingRatio: 1, reduceMotion: ReduceMotion.System };
/** The labels swap color a little after the highlight sets off, so the new one lights up as the highlight arrives. */
export const TEXT_COLOR_DELAY_MS = 120;
const TEXT_COLOR_MS = 150;

/**
 * One-of-N control. Options with an icon show only the icon; the label is their accessible name. A disabled option is greyed out.
 * One highlight sits behind the options and slides under the selected one.
 */
export function MenuSegmented<T extends string>({ options, value, onChange, disabled = false }: { options: Option<T>[]; value: T; onChange: (value: T) => void; disabled?: boolean }) {
  // Each option's frame, measured once per layout (not per frame).
  const [layouts, setLayouts] = useState<Partial<Record<T, LayoutRectangle>>>({});
  const target = layouts[value];
  // The highlight appears in place (opening the menu, rotating) and slides only once the user picks an option.
  const [slide, setSlide] = useState(false);
  const { colors } = useTheme();

  const highlight = useAnimatedStyle(
    () => (target ? { transform: [{ translateX: slide ? withSpring(target.x, SLIDE) : target.x }], width: slide ? withSpring(target.width, SLIDE) : target.width } : {}),
    [target?.x, target?.width, slide],
  );

  return (
    <View className="flex-row gap-1 rounded-xl border border-border bg-surface-input p-1">
      {/* Out of flow and childless, so moving it re-lays-out nothing else. */}
      {target ? (
        <Animated.View
          testID="segmented-highlight"
          pointerEvents="none"
          className="absolute left-0 rounded-lg border-2 border-accent bg-accent-subtle"
          style={[{ top: target.y, height: target.height }, highlight]}
        />
      ) : null}
      {options.map((option) => {
        const selected = option.value === value;
        const off = disabled || option.disabled === true;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityLabel={option.label}
            accessibilityState={{ selected, disabled: off }}
            disabled={off}
            onPress={() => {
              setSlide(true);
              onChange(option.value);
            }}
            onLayout={(e) => {
              const l = e.nativeEvent.layout;
              setLayouts((prev) => ({ ...prev, [option.value]: l }));
            }}
            className={`active:opacity-60 flex-1 items-center justify-center rounded-lg border-2 border-transparent py-2 ${option.disabled ? 'opacity-40' : ''}`}>
            {option.icon ?? (
              <Animated.Text
                className="text-sm font-semibold"
                style={{
                  color: selected ? colors.accent : colors.text,
                  transitionProperty: 'color',
                  transitionDuration: TEXT_COLOR_MS,
                  transitionDelay: TEXT_COLOR_DELAY_MS,
                }}>
                {option.label}
              </Animated.Text>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}
