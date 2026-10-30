import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

/** Icon, name and a one-line subtitle (its `lead` word may be colored), with a HIDDEN tag. Read out as one line. */
export function IdentityBlock({
  icon,
  name,
  lead,
  leadColor,
  rest,
  hidden,
  accessibilityLabel,
  testID,
}: {
  icon?: ReactNode;
  name: string;
  lead?: string | null;
  leadColor?: string;
  rest: string;
  hidden: boolean;
  accessibilityLabel: string;
  testID: string;
}) {
  return (
    <View testID={testID} accessible accessibilityLabel={accessibilityLabel} className="flex-row items-center gap-3">
      {icon}
      <View className="shrink gap-0.5">
        <Text numberOfLines={1} className="font-mono-bold text-xl text-text">{name}</Text>
        <View className="flex-row items-center gap-2">
          <Text testID="item-subtitle" numberOfLines={1} className="shrink text-base text-text-muted">
            {lead ? <Text style={{ color: leadColor }}>{lead}</Text> : null}
            {rest}
          </Text>
          {hidden ? <Text testID="hidden-tag" className="rounded border border-border px-1 text-xs font-semibold uppercase text-text-muted">Hidden</Text> : null}
        </View>
      </View>
    </View>
  );
}
