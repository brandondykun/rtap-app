import { StyleSheet, View } from 'react-native';

const ARM = 14;
const GAP = 5;
const THICKNESS = 1.5;

/** Thin cross with a center dot at the center of the map. Never intercepts touches. */
export function Crosshair() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} className="items-center justify-center">
      <View style={{ width: 2 * (ARM + GAP), height: 2 * (ARM + GAP) }} className="items-center justify-center">
        <View className="absolute bg-text" style={{ width: THICKNESS, height: ARM, top: 0 }} />
        <View className="absolute bg-text" style={{ width: THICKNESS, height: ARM, bottom: 0 }} />
        <View className="absolute bg-text" style={{ height: THICKNESS, width: ARM, left: 0 }} />
        <View className="absolute bg-text" style={{ height: THICKNESS, width: ARM, right: 0 }} />
        <View className="rounded-full bg-text" style={{ width: 4, height: 4 }} />
      </View>
    </View>
  );
}
