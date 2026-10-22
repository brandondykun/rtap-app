import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { TextField } from '@/components/ui/TextField';
import type { MissionSort } from '@/stores/settings';
import { useTheme } from '@/theme/ThemeProvider';

const CHIPS: readonly { sort: MissionSort; label: string }[] = [
  { sort: 'recent', label: 'Recent' },
  { sort: 'name', label: 'Name' },
  { sort: 'most', label: 'Most items' },
];

type Props = {
  landscape: boolean;
  subtitle: string;
  /** Sorting, search and New only make sense with missions to show. */
  showControls: boolean;
  sort: MissionSort;
  onSort: (sort: MissionSort) => void;
  /** null when not searching. */
  query: string | null;
  onQuery: (query: string | null) => void;
  onNew: () => void;
  /** Dev-only buttons. */
  extra?: ReactNode;
};

/** Title and totals, search and New, then the sort chips (or the search field while searching). */
export function MissionsHeader({ landscape, subtitle, showControls, sort, onSort, query, onQuery, onNew, extra }: Props) {
  const { colors } = useTheme();
  const searching = query !== null;
  const title = (
    <View className="flex-1">
      <Text className="text-3xl font-bold uppercase tracking-widest text-text">Missions</Text>
      {showControls ? <Text className="text-base text-text-muted">{subtitle}</Text> : null}
    </View>
  );
  const buttons = showControls ? (
    <>
      {searching ? null : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Search missions"
          onPress={() => onQuery('')}
          className="h-12 w-12 items-center justify-center rounded-xl border border-border bg-surface-raised active:opacity-60">
          <Icon name="magnify" size={24} color={colors.text} />
        </Pressable>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="New mission"
        onPress={onNew}
        className="h-12 flex-row items-center gap-1 rounded-xl bg-accent px-4 active:opacity-60">
        <Icon name="plus" size={22} color={colors['on-accent']} />
        <Text className="text-base font-bold text-on-accent">New</Text>
      </Pressable>
    </>
  ) : null;
  const filters = !showControls ? null : searching ? (
    <View className={`flex-row items-center gap-2 ${landscape ? 'flex-1' : ''}`}>
      <View className="flex-1">
        <TextField
          autoFocus
          value={query}
          onChangeText={onQuery}
          placeholder="Search by name"
          accessibilityLabel="Search by name"
          returnKeyType="search"
        />
      </View>
      <Pressable accessibilityRole="button" onPress={() => onQuery(null)} hitSlop={8} className="active:opacity-60 px-2">
        <Text className="text-base font-semibold text-text">Cancel</Text>
      </Pressable>
    </View>
  ) : (
    <View className="flex-row gap-2">
      {CHIPS.map((chip) => {
        const selected = chip.sort === sort;
        return (
          <Pressable
            key={chip.sort}
            accessibilityRole="button"
            accessibilityLabel={chip.label}
            accessibilityState={{ selected }}
            onPress={() => onSort(chip.sort)}
            className={`active:opacity-60 rounded-full border px-4 py-2 ${selected ? 'border-accent bg-accent-subtle' : 'border-border'}`}>
            <Text className={`text-base font-semibold ${selected ? 'text-accent' : 'text-text'}`}>{chip.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );

  if (landscape) {
    // One row: MISSIONS with the totals stacked under it on the left, the chips and buttons on the
    // right. The title column takes whatever room the controls leave, so its text wraps rather than
    // running under them.
    return (
      <View testID="missions-header" className="flex-row items-center gap-3 px-4 pb-3 pt-4">
        {/* While searching only MISSIONS stays, at its own width; the field takes the rest of the row. */}
        <View testID="missions-title" className={searching ? 'shrink-0' : 'flex-1'}>
          <View testID="missions-title-row" className="flex-row flex-wrap items-center gap-x-3">
            <Text className="text-3xl font-bold uppercase tracking-widest text-text">Missions</Text>
            {searching ? null : extra}
          </View>
          {showControls && !searching ? <Text className="text-base text-text-muted">{subtitle}</Text> : null}
        </View>
        <View testID="missions-controls" className={`flex-row items-center gap-3 ${searching ? 'flex-1' : 'shrink-0'}`}>
          {filters}
          {buttons}
        </View>
      </View>
    );
  }
  return (
    <View className="gap-4 px-4 pb-3 pt-4">
      <View className="flex-row items-center gap-3">
        {title}
        {extra}
        {buttons}
      </View>
      {filters}
    </View>
  );
}
