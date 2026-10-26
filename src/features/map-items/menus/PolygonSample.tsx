import { View } from 'react-native';

import { polygonTypeInfo, type PolygonType } from '@/features/symbology/polygon-types';
import { useTheme } from '@/theme/ThemeProvider';

/** A small area swatch in the type's color: its outline (dashed for fire-control areas) over a light fill. */
export function PolygonSample({ polygonType, size = 22 }: { polygonType: PolygonType; size?: number }) {
  const { colors } = useTheme();
  const { dash, color: token } = polygonTypeInfo(polygonType);
  const dashed = dash === 'dashed';
  const color = colors[token];
  return (
    <View style={{ width: size, height: size * 0.72, borderWidth: 2, borderRadius: 3, borderColor: color, borderStyle: dashed ? 'dashed' : 'solid' }}>
      <View style={{ flex: 1, backgroundColor: color, opacity: 0.15 }} />
    </View>
  );
}
