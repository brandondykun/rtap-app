import { useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';

import { useToast } from '@/stores/toast';
import { useTheme } from '@/theme/ThemeProvider';

import { Icon } from './Icon';

export const TOAST_DURATION_MS = 3000;

/** One short message at the top of the screen (command failures, confirmations). Tap to dismiss. */
export function Toast({ top }: { top: number }) {
  const toast = useToast((s) => s.toast);
  const hide = useToast((s) => s.hide);
  const { colors } = useTheme();

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => hide(toast.id), TOAST_DURATION_MS);
    return () => clearTimeout(timer);
  }, [toast, hide]);

  if (!toast) return null;
  const error = toast.kind === 'error';
  return (
    <View pointerEvents="box-none" className="absolute left-0 right-0 items-center" style={{ top }}>
      <Pressable
        accessibilityRole="alert"
        onPress={() => hide(toast.id)}
        className={`mx-4 flex-row items-center gap-2 rounded-2xl border bg-surface-chrome px-4 py-3 ${error ? 'border-danger' : 'border-border'}`}>
        <Icon name={error ? 'alert-circle-outline' : 'information-outline'} size={18} color={error ? colors.danger : colors.text} />
        <Text className="shrink text-sm text-text">{toast.message}</Text>
      </Pressable>
    </View>
  );
}
