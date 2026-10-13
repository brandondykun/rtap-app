import { Modal, Pressable, Text, View } from 'react-native';

type Props = {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  /** Shown under the message when the action failed; the dialog stays open to retry. */
  error?: string | null;
};

/** A centered confirmation for destructive actions: red confirm, outlined Cancel. Tapping outside cancels. */
export function ConfirmDialog({ visible, title, message, confirmLabel, onConfirm, onCancel, error }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel} supportedOrientations={['portrait', 'landscape']}>
      <View className="flex-1 items-center justify-center px-6">
        <Pressable accessibilityLabel="Cancel" onPress={onCancel} className="absolute inset-0 bg-surface-chrome" />
        <View accessibilityViewIsModal className="w-full max-w-sm gap-3 rounded-2xl border border-border bg-surface-raised p-5">
          <Text accessibilityRole="header" className="text-lg font-bold text-text">
            {title}
          </Text>
          <Text className="text-base text-text-muted">{message}</Text>
          {error ? <Text className="text-sm text-danger">{error}</Text> : null}
          <View className="mt-2 flex-row gap-3">
            <Pressable
              accessibilityRole="button"
              onPress={onCancel}
              className="flex-1 items-center rounded-xl border border-border bg-surface px-4 py-3 active:opacity-60">
              <Text className="font-semibold text-text">Cancel</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={confirmLabel}
              onPress={onConfirm}
              className="flex-1 items-center rounded-xl bg-danger px-4 py-3 active:opacity-60">
              <Text className="font-bold text-text">{confirmLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
