import { useContext, useLayoutEffect, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Icon, type IconName } from '@/components/ui/Icon';
import { useTheme } from '@/theme/ThemeProvider';

import { PanelHeaderSlot } from './panel-header-slot';

export type MenuHeaderAction = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  icon?: IconName;
  /** An outlined icon button (no text, `label` is its screen-reader name) instead of the amber primary. */
  iconOnly?: boolean;
  /** With `iconOnly`: an "on" state (amber icon on an amber-subtle fill), e.g. while search is open. */
  active?: boolean;
};

export type MenuHeaderProps = {
  title: string;
  /** Drawn left-aligned and growing in place of the centered title; `title` stays the accessible header name. */
  summary?: ReactNode;
  leading?: MenuHeaderAction;
  trailing?: MenuHeaderAction;
};

/**
 * Leading outlined action (Cancel / Close / Back), centered uppercase title, trailing amber primary button (or an
 * outlined icon button for a non-primary tool, like Layers' search). Inside a
 * Panel it is drawn pinned above the scrolling content, so Close and the primary action never scroll away.
 */
export function MenuHeader(props: MenuHeaderProps) {
  const slot = useContext(PanelHeaderSlot);
  // Every render hands the Panel the current row (its handlers close over the menu's latest state).
  useLayoutEffect(() => {
    slot?.(props);
  });
  // A layout cleanup: it runs before the next menu's header hands over its row, so it never clears that one.
  useLayoutEffect(() => () => slot?.(null), [slot]);
  return slot ? null : <MenuHeaderRow {...props} />;
}

/** The header row itself (in a portrait Panel it is also the sheet's drag area). */
export function MenuHeaderRow({ title, summary, leading, trailing }: MenuHeaderProps) {
  const { colors } = useTheme();
  return (
    <View className="flex-row items-center px-4 py-2">
      <View className="min-w-20 items-start">
        {leading?.iconOnly && leading.icon ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={leading.label}
            accessibilityState={{ disabled: !!leading.disabled }}
            disabled={leading.disabled}
            onPress={leading.onPress}
            hitSlop={8}
            className={`active:opacity-60 h-11 w-11 items-center justify-center rounded-xl border border-border bg-surface-raised ${leading.disabled ? 'opacity-40' : ''}`}>
            <Icon name={leading.icon} size={22} color={colors.text} />
          </Pressable>
        ) : leading ? (
          <Pressable
            accessibilityRole="button"
            onPress={leading.onPress}
            hitSlop={8}
            className={`flex-row items-center rounded-xl border border-border bg-surface-raised py-1.5 active:opacity-60 ${leading.icon ? 'pl-2 pr-4' : 'px-4'}`}>
            {leading.icon ? <Icon name={leading.icon} size={18} color={colors.text} /> : null}
            <Text className="font-semibold text-text">{leading.label}</Text>
          </Pressable>
        ) : null}
      </View>
      {summary ? (
        <View accessible accessibilityRole="header" accessibilityLabel={title} className="mx-2 flex-1">
          {summary}
        </View>
      ) : (
        <Text accessibilityRole="header" numberOfLines={1} className="flex-1 text-center text-base font-bold uppercase tracking-widest text-text">
          {title}
        </Text>
      )}
      <View className="min-w-20 items-end">
        {trailing?.iconOnly && trailing.icon ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={trailing.label}
            accessibilityState={{ disabled: !!trailing.disabled, selected: !!trailing.active }}
            disabled={trailing.disabled}
            onPress={trailing.onPress}
            hitSlop={8}
            className={`active:opacity-60 rounded-xl border px-3 py-1.5 ${trailing.active ? 'border-accent bg-accent-subtle' : 'border-border bg-surface-raised'} ${trailing.disabled ? 'opacity-40' : ''}`}>
            <Icon name={trailing.icon} size={20} color={trailing.active ? colors.accent : colors.text} />
          </Pressable>
        ) : trailing ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={trailing.label}
            accessibilityState={{ disabled: !!trailing.disabled }}
            disabled={trailing.disabled}
            onPress={trailing.onPress}
            className={`active:opacity-60 flex-row items-center gap-1 rounded-xl bg-accent px-4 py-1.5 ${trailing.disabled ? 'opacity-40' : ''}`}>
            {trailing.icon ? <Icon name={trailing.icon} size={18} color={colors['on-accent']} /> : null}
            <Text className="font-bold text-on-accent">{trailing.label}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
