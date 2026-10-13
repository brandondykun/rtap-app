import { useState, type Ref } from 'react';
import { TextInput, type TextInputProps } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

type Props = Omit<TextInputProps, 'style'> & {
  invalid?: boolean;
  mono?: boolean;
  /** Tighter side padding for short fixed-width fields (MGRS parts). */
  dense?: boolean;
  ref?: Ref<TextInput>;
};

/**
 * The app's one text input (menus, forms, screens): dark field, amber border while focused, red
 * when invalid, and single-line text vertically centred. Lint rejects a raw <TextInput> elsewhere.
 */
export function TextField({ invalid = false, mono = false, dense = false, ref, onFocus, onBlur, multiline, ...rest }: Props) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const border = invalid ? 'border-danger' : focused ? 'border-accent' : 'border-border';
  return (
    <TextInput
      ref={ref}
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
      // A fixed height and no line-height keep single-line text vertically centred on iOS
      // (Tailwind's text-lg adds a 28 pt line-height that pushes TextInput text down).
      style={multiline ? undefined : { textAlignVertical: 'center' }}
      className={`rounded-xl border-2 bg-surface-input ${dense ? 'px-2' : 'px-3'} text-[18px] text-text ${multiline ? 'min-h-24 py-3' : 'h-12 py-0'} ${mono ? 'font-mono' : ''} ${border}`}
      {...rest}
    />
  );
}
