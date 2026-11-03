import { useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';

import { useToast } from '@/stores/toast';
import { useTheme } from '@/theme/ThemeProvider';

import { Icon } from './Icon';

export const TOAST_DURATION_MS = 3000;
/** Lifts it off whatever is under it (map or panel). */
const TOAST_SHADOW = '0px 2px 8px rgba(0, 0, 0, 0.45)';

/**
 * One short message at the top of the screen (command failures, confirmations), on a solid card so it reads over the
 * map or a panel: red for an error. Tap to dismiss; a sticky one has ✕.
 */
export function Toast({ top }: { top: number }) {
  const toast = useToast((s) => s.toast);
  const hide = useToast((s) => s.hide);
  const { colors } = useTheme();

  useEffect(() => {
    if (!toast || toast.sticky) return;
    const timer = setTimeout(() => hide(toast.id), TOAST_DURATION_MS);
    return () => clearTimeout(timer);
  }, [toast, hide]);

  if (!toast) return null;
  const error = toast.kind === 'error';
  return (
    <View pointerEvents="box-none" className="absolute left-0 right-0 items-center" style={{ top }}>
      <Pressable
        accessibilityRole="alert"
        disabled={toast.sticky}
        onPress={() => hide(toast.id)}
        style={{ boxShadow: TOAST_SHADOW }}
        // An error is dark red, edged in red, its text very light red; anything else is a plain card.
        className={`active:opacity-60 mx-4 flex-row items-center gap-2 rounded-2xl border px-4 py-3 ${error ? 'border-danger bg-danger-subtle' : 'border-border bg-surface-raised'}`}>
        <Icon name={error ? 'alert-circle-outline' : 'information-outline'} size={18} color={error ? colors['on-danger-subtle'] : colors.text} />
        <View className="shrink">
          <Text className={`text-sm ${error ? 'font-semibold text-on-danger-subtle' : 'text-text'}`}>{toast.message}</Text>
          {toast.detail ? <Text className={`text-xs ${error ? 'text-on-danger-subtle opacity-80' : 'text-text-muted'}`}>{toast.detail}</Text> : null}
        </View>
        {toast.sticky ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Dismiss" onPress={() => hide(toast.id)} hitSlop={8} className="active:opacity-60">
            <Icon name="close" size={18} color={colors.text} />
          </Pressable>
        ) : null}
      </Pressable>
    </View>
  );
}
