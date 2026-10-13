import { View } from 'react-native';

// Proportions of the map crosshair at its full 38 pt size.
const FULL = 38;
const ARM = 14;
const THICKNESS = 1.5;
const DOT = 4;

/**
 * The map's crosshair (thin cross with a gap and a center dot). Used on the map and wherever the
 * UI refers to the crosshair (Center button, readout), so they read as the same thing.
 */
export function CrosshairGlyph({ size = FULL, color }: { size?: number; color: string }) {
  const k = size / FULL;
  const arm = ARM * k;
  const thickness = Math.max(1, THICKNESS * k);
  const dot = Math.max(2, DOT * k);
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ position: 'absolute', backgroundColor: color, width: thickness, height: arm, top: 0 }} />
      <View style={{ position: 'absolute', backgroundColor: color, width: thickness, height: arm, bottom: 0 }} />
      <View style={{ position: 'absolute', backgroundColor: color, height: thickness, width: arm, left: 0 }} />
      <View style={{ position: 'absolute', backgroundColor: color, height: thickness, width: arm, right: 0 }} />
      <View style={{ backgroundColor: color, width: dot, height: dot, borderRadius: dot / 2 }} />
    </View>
  );
}
