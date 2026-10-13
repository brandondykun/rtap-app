import { useState, type Ref } from 'react';
import { TextInput, type TextInputProps } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

type Props = Omit<TextInputProps, 'style'> & { invalid?: boolean; mono?: boolean; ref?: Ref<TextInput> };

/** Dark input with an amber border while focused and a red border when invalid. */
export function MenuTextField({ invalid = false, mono = false, ref, onFocus, onBlur, ...rest }: Props) {
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
      className={`rounded-xl border-2 bg-surface-input px-3 py-3 text-lg text-text ${mono ? 'font-mono' : ''} ${border}`}
      {...rest}
    />
  );
}
