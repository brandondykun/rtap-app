import { View } from 'react-native';

import { lineTypeInfo, type LineType } from '@/features/symbology/line-types';
import { useTheme } from '@/theme/ThemeProvider';

const THICKNESS = { normal: 3, heavy: 5, wide: 7 } as const;

/** A short horizontal line in the type's style, for the type dropdown and Layers rows. */
export function LineSample({ lineType, width = 28 }: { lineType: LineType; width?: number }) {
  const { colors } = useTheme();
  const info = lineTypeInfo(lineType);
  const h = THICKNESS[info.width];
  if (info.dash === 'dashed') {
    return (
      <View style={{ width, height: h, flexDirection: 'row', gap: 3 }}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={{ flex: 1, height: h, backgroundColor: colors.friendly, borderRadius: 1 }} />
        ))}
      </View>
    );
  }
  return <View style={{ width, height: h, backgroundColor: colors.friendly, borderRadius: h / 2 }} />;
}
