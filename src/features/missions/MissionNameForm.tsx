import { useMemo } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TextField } from '@/components/ui/TextField';

// A swipe down the sheet's top strip closes it: far enough, or fast enough.
const DISMISS_DISTANCE = 48;
const DISMISS_VELOCITY = 600;

type Props = {
  title: string;
  name: string;
  onChangeName: (name: string) => void;
  submitLabel: string;
  onSubmit: () => void;
  onCancel: () => void;
  error: string | null;
};

/** The mission name sheet shared by New mission and Rename mission. */
export function MissionNameForm({ title, name, onChangeName, submitLabel, onSubmit, onCancel, error }: Props) {
  // The sheet spans the screen width in landscape: keep the field and buttons clear of the notch side.
  const insets = useSafeAreaInsets();
  // Android's sheet runs under the navigation bar, has no native grabber, and needs the sheet's corner radius.
  const android = Platform.OS === 'android';
  // Android's sheet doesn't follow a drag on its content, so its top strip closes it on a downward swipe instead.
  const dismissSwipe = useMemo(
    () =>
      Gesture.Pan()
        .withTestId('sheet-dismiss-swipe')
        .activeOffsetY(12)
        .failOffsetY(-12)
        .runOnJS(true)
        .onEnd((e) => {
          if (e.translationY > DISMISS_DISTANCE || e.velocityY > DISMISS_VELOCITY) onCancel();
        }),
    [onCancel],
  );
  return (
    <View
      testID="mission-name-form"
      className={`gap-4 bg-surface pt-10 ${android ? 'rounded-t-[28px]' : ''}`}
      style={{ paddingLeft: insets.left + 16, paddingRight: insets.right + 16, paddingBottom: (android ? insets.bottom : 0) + 32 }}>
      {/* Same title style as the map menus' headers. */}
      <Text accessibilityRole="header" className="text-base font-bold uppercase tracking-widest text-text">
        {title}
      </Text>
      {android ? (
        // Over the grabber and the title row; after the title so it takes the touches.
        <GestureDetector gesture={dismissSwipe}>
          <View testID="sheet-grabber" className="absolute left-0 right-0 top-0 h-16 items-center pt-3">
            <View className="h-1 w-8 rounded-full bg-text-muted opacity-40" />
          </View>
        </GestureDetector>
      ) : null}
      <TextField
        clearable
        accessibilityLabel="Mission name"
        value={name}
        onChangeText={onChangeName}
        autoFocus
        selectTextOnFocus
        returnKeyType="done"
        onSubmitEditing={onSubmit}
        placeholder="Mission name"
        invalid={error !== null}
      />
      {error ? <Text className="text-sm text-danger">{error}</Text> : null}
      <View className="flex-row gap-3">
        <Pressable
          accessibilityRole="button"
          onPress={onCancel}
          className="active:opacity-60 flex-1 items-center rounded-xl border border-border bg-surface-raised py-3">
          <Text className="font-semibold text-text">Cancel</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onSubmit} className="active:opacity-60 flex-1 items-center rounded-xl bg-accent py-3">
          <Text className="font-bold text-on-accent">{submitLabel}</Text>
        </Pressable>
      </View>
    </View>
  );
}
