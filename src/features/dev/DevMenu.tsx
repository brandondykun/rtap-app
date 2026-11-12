import { useEffect, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';

import { Icon, type IconName } from '@/components/ui/Icon';
import { useTheme } from '@/theme/ThemeProvider';

export type DevAction = { label: string; icon: IconName; onPress: () => void };

/** How long "Hide button" keeps the wrench out of the header, for screenshots. */
export const DEV_BUTTON_HIDE_MS = 10_000;

/**
 * Development builds only (the caller checks `__DEV__`): one small wrench in a header that opens the developer actions
 * in a centered card, styled as ConfirmDialog. Choosing one closes the card, then runs it. The last action, Hide
 * button, blanks the wrench for DEV_BUTTON_HIDE_MS (keeping its space so the header doesn't shift) for screenshots.
 */
export function DevMenu({ actions }: { actions: readonly DevAction[] }) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const close = () => setOpen(false);
  useEffect(() => {
    if (!hidden) return;
    const timer = setTimeout(() => setHidden(false), DEV_BUTTON_HIDE_MS);
    return () => clearTimeout(timer);
  }, [hidden]);
  const allActions: readonly DevAction[] = [...actions, { label: 'Hide button', icon: 'eye-off-outline', onPress: () => setHidden(true) }];
  if (hidden) return <View testID="dev-menu-hidden" className="h-12 w-8" />;
  return (
    <>
      <Pressable accessibilityRole="button" accessibilityLabel="Developer menu" onPress={() => setOpen(true)} hitSlop={8} className="h-12 w-8 items-center justify-center active:opacity-60">
        <Icon name="wrench-outline" size={20} color={colors['text-muted']} />
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={close} supportedOrientations={['portrait', 'landscape']}>
        <View className="flex-1 items-center justify-center px-6">
          {/* pressed-feedback-exempt: the backdrop behind the menu, not a visible control */}
          <Pressable accessibilityLabel="Close developer menu" onPress={close} className="absolute inset-0 bg-surface-chrome" />
          <View testID="dev-menu" accessibilityViewIsModal className="w-full max-w-sm gap-3 rounded-2xl border border-border bg-surface-raised p-5">
            <View>
              <Text accessibilityRole="header" className="text-lg font-bold text-text">
                Developer
              </Text>
              <Text className="text-sm text-text-muted">Development builds only</Text>
            </View>
            {allActions.map((a) => (
              <Pressable
                key={a.label}
                accessibilityRole="button"
                accessibilityLabel={a.label}
                onPress={() => {
                  close();
                  a.onPress();
                }}
                className="h-12 flex-row items-center gap-3 rounded-xl border border-border bg-surface px-4 active:opacity-60">
                <Icon name={a.icon} size={20} color={colors.text} />
                <Text className="font-semibold text-text">{a.label}</Text>
              </Pressable>
            ))}
            <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={close} className="mt-1 items-center py-2 active:opacity-60">
              <Text className="font-semibold text-text-muted">Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}
