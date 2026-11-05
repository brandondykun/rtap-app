import { useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, Text, View, type TextInput } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { TextField } from '@/components/ui/TextField';
import { useTheme } from '@/theme/ThemeProvider';

import { PanelScrollContext } from './panel-header-slot';

/** `keywords`: more it is found by when searching (a type's short code, like PL or TRP). */
type Option<T extends string> = { value: T; label: string; icon?: ReactNode; keywords?: string };

/** From this many options the open list starts with a search box; shorter lists are taken in at a glance. */
export const SEARCH_MIN_OPTIONS = 8;

/** The options whose label or keywords contain `query`, ignoring case and spaces around it. */
export function filterOptions<T extends string>(options: Option<T>[], query: string): Option<T>[] {
  const q = query.trim().toLowerCase();
  if (q === '') return options;
  return options.filter((o) => o.label.toLowerCase().includes(q) || (o.keywords?.toLowerCase().includes(q) ?? false));
}

/**
 * Dropdown field that expands an inline list (no native picker), so it works inside the panel. A long list opens with a
 * search box that narrows it; while typing in it, the panel keeps the dropdown at its top, the list under it above the
 * keyboard.
 */
export function MenuSelect<T extends string>({ label, options, value, onChange, disabled = false }: { label: string; options: Option<T>[]; value: T; onChange: (value: T) => void; disabled?: boolean }) {
  const { colors } = useTheme();
  const panel = useContext(PanelScrollContext);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const field = useRef<View>(null);
  const search = useRef<TextInput>(null);
  const searchable = options.length >= SEARCH_MIN_OPTIONS;
  const currentOption = options.find((o) => o.value === value);
  const current = currentOption?.label ?? '';
  const shown = searchable ? filterOptions(options, query) : options;
  const anchorFocus = panel?.anchorFocus;
  useEffect(() => {
    if (!open || !searchable || !anchorFocus || !search.current || !field.current) return;
    return anchorFocus(search.current, field.current);
  }, [open, searchable, anchorFocus]);
  const toggle = () => {
    setQuery('');
    setOpen((o) => !o);
  };
  // No flex here: in a row the caller wraps it in flex-1; stacked, flex-1 would let it shrink to nothing.
  return (
    <View>
      <Pressable
        ref={field}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${current}`}
        accessibilityState={{ expanded: open, disabled }}
        disabled={disabled}
        onPress={toggle}
        className="active:opacity-60 h-12 flex-row items-center justify-between rounded-xl border border-border bg-surface-input px-3">
        <View className="shrink flex-row items-center gap-2">
          {currentOption?.icon ?? null}
          <Text numberOfLines={1} className="shrink text-lg text-text">
            {current}
          </Text>
        </View>
        <Icon name={open ? 'chevron-up' : 'chevron-down'} size={20} color={colors['text-muted']} />
      </Pressable>
      {open && !disabled ? (
        <View testID="menu-select-options" className="mt-1 overflow-hidden rounded-xl border border-border bg-surface-raised">
          {searchable ? (
            <View className="p-2">
              <TextField
                ref={search}
                nested
                icon="magnify"
                clearable
                accessibilityLabel={`Search ${label.toLowerCase()}`}
                placeholder="Search"
                value={query}
                onChangeText={setQuery}
                autoCorrect={false}
                returnKeyType="done"
              />
            </View>
          ) : null}
          {shown.map((option) => (
            <Pressable
              key={option.value}
              accessibilityRole="button"
              accessibilityState={{ selected: option.value === value }}
              onPress={() => {
                onChange(option.value);
                setOpen(false);
                setQuery('');
              }}
              className="active:opacity-60 flex-row items-center justify-between px-3 py-3">
              <View className="flex-row items-center gap-2">
                {option.icon ?? null}
                <Text className="text-base text-text">{option.label}</Text>
              </View>
              {option.value === value ? <Icon name="check" size={18} color={colors.accent} /> : null}
            </Pressable>
          ))}
          {shown.length === 0 ? <Text className="px-3 py-3 text-base text-text-muted">No matches</Text> : null}
        </View>
      ) : null}
    </View>
  );
}
