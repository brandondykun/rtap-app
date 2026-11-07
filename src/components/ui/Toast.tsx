import { useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EDGE } from '@/features/map/layout';
import { useToast } from '@/stores/toast';
import { useTheme } from '@/theme/ThemeProvider';

import { glassHalo } from './glass';
import { Icon } from './Icon';

export const TOAST_DURATION_MS = 3000;
/** Lifts it off whatever is under it (map or panel). */
const TOAST_SHADOW = '0px 2px 8px rgba(0, 0, 0, 0.45)';

/** Average mode's orange edge down the notice's left side. */
const AVERAGE_EDGE = 3;

/**
 * One short message at the top of the screen (command failures, confirmations), on a solid card so it reads over the
 * map or a panel: red for an error. Tap to dismiss; a sticky one has ✕. Average mode's notice has its own look
 * (AverageNotice).
 */
export function Toast({ top, landscape }: { top: number; landscape: boolean }) {
  const toast = useToast((s) => s.toast);
  const hide = useToast((s) => s.hide);
  const { colors } = useTheme();

  useEffect(() => {
    if (!toast || toast.sticky) return;
    const timer = setTimeout(() => hide(toast.id), TOAST_DURATION_MS);
    return () => clearTimeout(timer);
  }, [toast, hide]);

  if (!toast) return null;
  if (toast.kind === 'average') return <AverageNotice top={top} landscape={landscape} title={toast.title ?? ''} message={toast.message} onClose={() => hide(toast.id)} />;
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

/**
 * Average mode's notice (hold still): a glass card like the toolbar above it, edged in Average mode's orange, with a
 * phone-vibrating icon, an orange title as on the AVERAGE MODE line, the message, and ✕ past a hairline. Portrait: the
 * title over the message, across the screen like the toolbar. Landscape: one line, the message after a dot.
 */
function AverageNotice({ top, landscape, title, message, onClose }: { top: number; landscape: boolean; title: string; message: string; onClose: () => void }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const halo = glassHalo(colors);
  const heading = (
    <Text style={[halo, { color: colors.averaged }]} className="font-mono-bold text-xs tracking-wide">
      {title}
    </Text>
  );
  return (
    <View pointerEvents="box-none" className="absolute left-0 right-0 items-center" style={{ top }}>
      <View
        testID="toast-average"
        accessibilityRole="alert"
        style={{
          borderLeftWidth: AVERAGE_EDGE,
          borderLeftColor: colors.averaged,
          marginLeft: insets.left + EDGE,
          marginRight: insets.right + EDGE,
        }}
        className={`flex-row items-center gap-3 rounded-2xl bg-surface-glass py-2.5 pl-4 pr-2 ${landscape ? '' : 'self-stretch'}`}>
        <Icon name="vibrate" size={22} color={colors.averaged} style={halo} />
        {landscape ? (
          <Text numberOfLines={1} style={halo} className="shrink text-sm text-text">
            {heading}
            {` · ${message.charAt(0).toLowerCase()}${message.slice(1)}`}
          </Text>
        ) : (
          <View className="shrink">
            {heading}
            <Text style={halo} className="text-sm text-text">
              {message}
            </Text>
          </View>
        )}
        <View testID="toast-average-divider" className="ml-auto h-7 w-px bg-divider" />
        <Pressable accessibilityRole="button" accessibilityLabel="Dismiss" onPress={onClose} hitSlop={8} className="active:opacity-60 h-9 w-9 items-center justify-center">
          <Icon name="close" size={20} color={colors.text} style={halo} />
        </Pressable>
      </View>
    </View>
  );
}
