import type { ReactNode } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/components/ui/Icon';
import { EDGE, TOOLBAR_HEIGHT } from '@/features/map/layout';
import { useTheme } from '@/theme/ThemeProvider';

import { ToolButton } from './ToolButton';

export type ToolId = 'unit' | 'point' | 'line' | 'polygon' | 'measure' | 'layers';

type Props = {
  landscape: boolean;
  activeTool: ToolId | null;
  onMenu?: () => void;
  onUnit?: () => void;
  onPoint?: () => void;
  onLine?: () => void;
  onPolygon?: () => void;
  onMeasure?: () => void;
  onLayers?: () => void;
  onSettings?: () => void;
};

/**
 * Top bar in both orientations: full width in portrait, top-right (content width) in landscape
 * so a left panel never covers it. Tools scroll horizontally in portrait if they overflow.
 */
export function Toolbar({ landscape, activeTool, onMenu, onUnit, onPoint, onLine, onPolygon, onMeasure, onLayers, onSettings }: Props) {
  const insets = useSafeAreaInsets();
  const position = landscape
    ? { top: insets.top + EDGE, right: insets.right + EDGE }
    : { top: insets.top + EDGE, left: insets.left + EDGE, right: insets.right + EDGE };

  const tools = (
    <>
      <ToolButton icon="rhombus-outline" label="UNIT" active={activeTool === 'unit'} onPress={onUnit} />
      <ToolButton icon="map-marker-outline" label="POINT" active={activeTool === 'point'} onPress={onPoint} />
      <ToolButton icon="vector-polyline" label="LINE" active={activeTool === 'line'} onPress={onLine} />
      <ToolButton icon="pentagon-outline" label="POLYGON" active={activeTool === 'polygon'} onPress={onPolygon} />
      <ToolButton icon="ruler" label="MEASURE" active={activeTool === 'measure'} onPress={onMeasure} />
      <ToolButton icon="layers-outline" label="LAYERS" active={activeTool === 'layers'} onPress={onLayers} />
    </>
  );

  return (
    <View
      testID="toolbar"
      style={[position, { height: TOOLBAR_HEIGHT }]}
      className="absolute flex-row items-center rounded-3xl border border-border bg-surface-chrome px-2">
      <BarIcon icon="menu" label="Menu" onPress={onMenu} />
      <Divider />
      {landscape ? (
        <View className="flex-row items-center gap-1">{tools}</View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ flex: 1 }}
          contentContainerStyle={{ alignItems: 'center', gap: 4 }}>
          {tools}
        </ScrollView>
      )}
      <Divider />
      <BarIcon icon="cog-outline" label="Settings" onPress={onSettings} />
    </View>
  );
}

function BarIcon({ icon, label, onPress }: { icon: IconName; label: string; onPress?: () => void }): ReactNode {
  const { colors } = useTheme();
  const disabled = !onPress;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={6}
      className={`h-10 w-10 items-center justify-center ${disabled ? 'opacity-40' : ''}`}>
      <Icon name={icon} size={22} color={colors.text} />
    </Pressable>
  );
}

function Divider() {
  return <View className="mx-1.5 h-7 w-px bg-border" />;
}
