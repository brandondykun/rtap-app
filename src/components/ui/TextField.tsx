import { useRef, useState, type Ref } from 'react';
import { Platform, Pressable, TextInput, View, type TextInputProps } from 'react-native';

import { useSettings } from '@/stores/settings';
import { useTheme } from '@/theme/ThemeProvider';

import { Icon, type IconName } from './Icon';

/** Keeps the keyboard's suggestion strip away (see the Keyboard suggestions setting). */
const NO_SUGGESTIONS = { autoCorrect: false, spellCheck: false, textContentType: 'none' } as const;

/** Keyboards (and input modes) that are an iPhone number pad: no return key. */
const NUMBER_PAD_KEYBOARDS = new Set<TextInputProps['keyboardType']>(['number-pad', 'decimal-pad', 'numeric', 'phone-pad']);
const NUMBER_PAD_MODES = new Set<TextInputProps['inputMode']>(['numeric', 'decimal', 'tel']);

/**
 * On an iPhone number pad, a return key type (or accessory button label) makes React Native add its own toolbar with a
 * Done button over the keyboard, which stacks under the KeyboardBar's Done. The pad has no return key to show anyway, so
 * the field drops both there; Android's number pad has a return key and keeps them.
 */
export function withoutNumberPadReturnKey<T extends Pick<TextInputProps, 'keyboardType' | 'inputMode' | 'returnKeyType' | 'enterKeyHint' | 'inputAccessoryViewButtonLabel'>>(props: T): T {
  if (Platform.OS !== 'ios') return props;
  if (!NUMBER_PAD_KEYBOARDS.has(props.keyboardType) && !NUMBER_PAD_MODES.has(props.inputMode)) return props;
  const { returnKeyType: _r, enterKeyHint: _e, inputAccessoryViewButtonLabel: _l, ...rest } = props;
  return rest as T;
}

type Props = Omit<TextInputProps, 'style'> & {
  invalid?: boolean;
  mono?: boolean;
  /** Tighter side padding for short fixed-width fields (MGRS parts). */
  dense?: boolean;
  /** 8 pt corners instead of 12, to nest concentrically inside a card with 8 pt padding. */
  nested?: boolean;
  /** An × on the right that empties the field (shown while it has text and is editable). Single-line only. */
  clearable?: boolean;
  /** A muted icon inside the field on the left (a search field's magnifier). Single-line only. */
  icon?: IconName;
  ref?: Ref<TextInput>;
};

/**
 * The app's one text input (menus, forms, screens): dark field, amber border while focused, red
 * when invalid, and single-line text vertically centred. Lint rejects a raw <TextInput> elsewhere.
 */
export function TextField({ invalid = false, mono = false, dense = false, nested = false, clearable = false, icon, ref, onFocus, onBlur, multiline, ...rest }: Props) {
  const { colors } = useTheme();
  const suggestions = useSettings((s) => s.keyboardSuggestions);
  const [focused, setFocused] = useState(false);
  const inner = useRef<TextInput>(null);
  const border = invalid ? 'border-danger' : focused ? 'border-accent' : 'border-border';
  const showIcon = icon !== undefined && !multiline;
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
      // No suggestion strip over the keyboard (iOS's predictive / AutoFill bar) unless Settings asks for it: it takes room
      // the menu and map need. All three are needed, or iOS keeps the strip. A field's own choice (names: never) wins.
      {...(suggestions ? null : NO_SUGGESTIONS)}
      // A fixed height and no line-height keep single-line text vertically centred on iOS
      // (Tailwind's text-lg adds a 28 pt line-height that pushes TextInput text down). Multiline text and its
      // placeholder start at the top: Android would otherwise centre them vertically.
      style={{ textAlignVertical: multiline ? 'top' : 'center' }}
      className={`${nested ? 'rounded-lg' : 'rounded-xl'} border bg-surface-input ${dense ? 'px-2' : 'px-3'} ${showIcon ? 'pl-11' : ''} ${clearable ? 'pr-11' : ''} text-[18px] text-text ${multiline ? 'min-h-24 py-3' : 'h-12 py-0'} ${mono ? 'font-mono' : ''} ${border}`}
      {...withoutNumberPadReturnKey(rest)}
    />
  );
  if (!clearable && !showIcon) return input;
  return (
    <View className="justify-center">
      {input}
      {showIcon ? (
        <View testID="text-field-icon" pointerEvents="none" className="absolute left-3">
          <Icon name={icon} size={22} color={colors['text-muted']} />
        </View>
      ) : null}
      {showClear ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Clear ${rest.accessibilityLabel ?? 'text'}`}
          onPress={clear}
          hitSlop={4}
          className="active:opacity-60 absolute right-1 h-12 w-10 items-center justify-center">
          <Icon name="close-circle" size={20} color={colors['text-muted']} />
        </Pressable>
      ) : null}
    </View>
  );
}
