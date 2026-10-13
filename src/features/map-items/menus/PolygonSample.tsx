import { View } from 'react-native';

import { polygonTypeInfo, type PolygonType } from '@/features/symbology/polygon-types';
import { useTheme } from '@/theme/ThemeProvider';

/** A small area swatch: friendly outline (dashed for fire-control areas) over a light fill. */
export function PolygonSample({ polygonType, size = 22 }: { polygonType: PolygonType; size?: number }) {
  const { colors } = useTheme();
  const dashed = polygonTypeInfo(polygonType).dash === 'dashed';
  return (
    <View style={{ width: size, height: size * 0.72, borderWidth: 2, borderRadius: 3, borderColor: colors.friendly, borderStyle: dashed ? 'dashed' : 'solid' }}>
      <View style={{ flex: 1, backgroundColor: colors.friendly, opacity: 0.15 }} />
    </View>
  );
}
