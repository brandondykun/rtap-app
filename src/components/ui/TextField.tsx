import { useRef, useState, type Ref } from 'react';
import { Pressable, TextInput, View, type TextInputProps } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

import { Icon } from './Icon';

type Props = Omit<TextInputProps, 'style'> & {
  invalid?: boolean;
  mono?: boolean;
  /** Tighter side padding for short fixed-width fields (MGRS parts). */
  dense?: boolean;
  /** An × on the right that empties the field (shown while it has text and is editable). Single-line only. */
  clearable?: boolean;
  ref?: Ref<TextInput>;
};

/**
 * The app's one text input (menus, forms, screens): dark field, amber border while focused, red
 * when invalid, and single-line text vertically centred. Lint rejects a raw <TextInput> elsewhere.
 */
export function TextField({ invalid = false, mono = false, dense = false, clearable = false, ref, onFocus, onBlur, multiline, ...rest }: Props) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const inner = useRef<TextInput>(null);
  const border = invalid ? 'border-danger' : focused ? 'border-accent' : 'border-border';
  const showClear = clearable && !multiline && rest.editable !== false && (rest.value ?? '') !== '';
  // The field keeps its own handle (the clear button refocuses it) and still hands the node to `ref`.
  const setRef = (node: TextInput | null) => {
    inner.current = node;
    if (typeof ref === 'function') ref(node);
    else if (ref) ref.current = node;
  };
  const clear = () => {
    rest.onChangeText?.('');
    inner.current?.focus();
  };
  const input = (
    <TextInput
      ref={setRef}
      placeholderTextColor={colors['text-muted']}
      onFocus={(e) => {
        setFocused(true);
        onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        onBlur?.(e);
      }}
      multiline={multiline}
      // Android landscape would otherwise swap the screen for a full-screen editor (hiding the map and menus).
      disableFullscreenUI
      // A fixed height and no line-height keep single-line text vertically centred on iOS
      // (Tailwind's text-lg adds a 28 pt line-height that pushes TextInput text down).
      style={multiline ? undefined : { textAlignVertical: 'center' }}
      className={`rounded-xl border-2 bg-surface-input ${dense ? 'px-2' : 'px-3'} ${clearable ? 'pr-11' : ''} text-[18px] text-text ${multiline ? 'min-h-24 py-3' : 'h-12 py-0'} ${mono ? 'font-mono' : ''} ${border}`}
      {...rest}
    />
  );
  if (!clearable) return input;
  return (
    <View className="justify-center">
      {input}
      {showClear ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Clear ${rest.accessibilityLabel ?? 'text'}`}
          onPress={clear}
          hitSlop={4}
          className="absolute right-1 h-12 w-10 items-center justify-center">
          <Icon name="close-circle" size={20} color={colors['text-muted']} />
        </Pressable>
      ) : null}
    </View>
  );
}
