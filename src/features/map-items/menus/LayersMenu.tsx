import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MenuCountButton } from '@/components/menu/MenuCountButton';
import { MenuHeader } from '@/components/menu/MenuHeader';
import { MenuListItem } from '@/components/menu/MenuListItem';
import { MenuSegmented } from '@/components/menu/MenuSegmented';
import { usePanelListProps } from '@/components/menu/panel-list';
import { Icon, type IconName } from '@/components/ui/Icon';
import { TextField } from '@/components/ui/TextField';
import { notifyError } from '@/features/feedback/feedback';
import { formatCoordinate } from '@/features/map/interaction/readout';
import { defineMenu, type MenuComponentProps } from '@/features/menus/define-menu';
import { useMenuEntryState } from '@/features/menus/menu-entry-memory';
import { itemCategory, type ItemCategory } from '@/features/symbology/categories';
import { lineTypeInfo } from '@/features/symbology/line-types';
import { polygonTypeInfo } from '@/features/symbology/polygon-types';
import { AFFILIATION_LABELS, affiliationOf, composeSidc, type Affiliation } from '@/features/symbology/presets';
import { SymbolImage } from '@/features/symbology/SymbolImage';
import { useObservable } from '@/hooks/use-observable';
import { useCommandContext } from '@/lib/db/command-context-provider';
import { formatDistance } from '@/lib/geo/format/measure';
import { useLayersView } from '@/stores/layers-view';
import { useMenu } from '@/stores/menu';
import { useSettings, type CoordinateFormat } from '@/stores/settings';
import { useTheme } from '@/theme/ThemeProvider';

import { setItemHidden, setItemShowRing, setItemsHidden, setItemsShowRing } from '../commands';
import { categoryCounts, layerRow, layerRows, type LayerRow } from '../layer-rows';
import { formatArea } from '../polygon-measure';
import { observeHiddenItemIds, observeMissionItems, observeRingItemIds, type MapItemSnapshot } from '../repository';
import { openItemMenu } from './item-menus';
import { LineSample } from './LineSample';
import { PolygonSample } from './PolygonSample';

const NO_ITEMS: MapItemSnapshot[] = [];
const NO_IDS: string[] = [];
const count = (n: number) => n.toLocaleString('en-US');
/** Tab counts stop at 99+ so all four tabs fit on one line. */
const tabCount = (n: number) => (n > 99 ? '99+' : String(n));

// `label` is the screen-reader name; `short` is what the tab shows, so all four fit on one line.
/** The Units tab's filter chips, in the order of the design: friendly and hostile first. */
const CHIP_AFFILIATIONS: readonly Affiliation[] = ['friend', 'hostile', 'unknown', 'neutral'];
const NO_AFFILIATION_COUNTS: Record<Affiliation, number> = { friend: 0, hostile: 0, neutral: 0, unknown: 0 };

/** The empty state's box is at least this tall, and otherwise fills the panel below the tabs. */
const EMPTY_MIN_HEIGHT = 220;

/** `icon` is the tab's toolbar tool's, shown on its empty state. */
const TABS: { id: ItemCategory; label: string; short: string; one: string; noun: string; icon: IconName }[] = [
  { id: 'unit', label: 'Units', short: 'Units', one: 'unit', noun: 'units', icon: 'rhombus-outline' },
  { id: 'point', label: 'Points', short: 'Points', one: 'point', noun: 'points', icon: 'map-marker-outline' },
  { id: 'line', label: 'Lines', short: 'Lines', one: 'line', noun: 'lines', icon: 'vector-polyline' },
  { id: 'polygon', label: 'Polygons', short: 'Polys', one: 'polygon', noun: 'polygons', icon: 'pentagon-outline' },
];
const RING_ICON = 'record-circle-outline';
/** Scrolled further down than this, a button brings the list back to the top. */
export const BACK_TO_TOP_AFTER = 600;
const TOP_BUTTON_HEIGHT = 40;
/** Lifts it a little off the rows passing under it. */
const TOP_BUTTON_SHADOW = '0px 2px 6px rgba(0, 0, 0, 0.45)';
/** The Top button's lowest: just off the screen edge where there is no home indicator to keep clear of. */
const TOP_BUTTON_MIN_BOTTOM = 12;
/** Between the last row and the Top button, when scrolled to the end. */
const TOP_BUTTON_GAP = 8;

/** The mission's items in one tab per category: search, show/hide, tap to open. */
export function LayersMenu({ missionId }: MenuComponentProps<'layers'>) {
  const ctx = useCommandContext();
  const close = useMenu((s) => s.closeMenu);
  const coordinateFormat = useSettings((s) => s.coordinateFormat);
  const items = useObservable(() => observeMissionItems(ctx.db, missionId), NO_ITEMS, [ctx, missionId]);
  const hidden = useObservable(() => observeHiddenItemIds(ctx.db), NO_IDS, [ctx]);
  const ringIds = useObservable(() => observeRingItemIds(ctx.db), NO_IDS, [ctx]);
  // Kept for an item drilled into and back out of.
  const [query, setQuery] = useMenuEntryState('query', '');
  const [searchOpen, setSearchOpen] = useMenuEntryState('searchOpen', false);
  // Focus only when the user opens search, not when coming Back to Layers with it still open.
  const [focusSearch, setFocusSearch] = useState(false);
  const chosenTab = useLayersView((s) => s.tab);
  const chosenAffiliation = useLayersView((s) => s.unitAffiliation);
  const byTab = useMemo(() => categoryCounts(items), [items]);
  // The tab chosen last; until then the first tab that has items.
  const tab = chosenTab ?? TABS.find((t) => byTab[t.id] > 0)?.id ?? 'unit';
  const tabInfo = TABS.find((t) => t.id === tab)!;
  const byAffiliation = useMemo(() => affiliationCounts(items), [items]);
  // A chip whose units are all gone falls back to All, rather than showing an empty list.
  const affiliation = tab === 'unit' && chosenAffiliation && byAffiliation[chosenAffiliation] > 0 ? chosenAffiliation : null;
  // No rows built up front: the list builds each one as it scrolls into view.
  const { matches, matched, total, hiddenIds, visibleIds, ringableIds, ringOnIds } = useMemo(
    () => layerRows(items, hidden, query, 0, tab, ringIds, affiliation),
    [items, hidden, query, tab, ringIds, affiliation],
  );
  // Empty is the whole tab, not what a chip leaves.
  const empty = byTab[tab] === 0;
  const hiddenSet = useMemo(() => new Set(hidden), [hidden]);
  const ringOnSet = useMemo(() => new Set(ringIds), [ringIds]);
  const panelListProps = usePanelListProps<MapItemSnapshot>();
  const { colors } = useTheme();
  const list = useRef<FlashListRef<MapItemSnapshot> | null>(null);
  // Another tab or chip is a new list: it starts at the top, with the tabs and chips in view.
  const shownList = useRef({ tab, affiliation });
  useEffect(() => {
    if (shownList.current.tab === tab && shownList.current.affiliation === affiliation) return;
    shownList.current = { tab, affiliation };
    list.current?.scrollToOffset({ offset: 0, animated: false });
  }, [tab, affiliation]);
  const [farDown, setFarDown] = useState(false);
  // What the empty state needs to fill the rest of the panel: the list's height, and where the box starts in it.
  const [viewportHeight, setViewportHeight] = useState(0);
  const [sectionTop, setSectionTop] = useState(0);
  const [emptyTop, setEmptyTop] = useState(0);
  // Down by the screen edge, only clear of the home indicator (lower than the list's own bottom padding).
  const topButtonBottom = Math.max(useSafeAreaInsets().bottom, TOP_BUTTON_MIN_BOTTOM);
  // The panel's scroll props, also keeping the list (to scroll it back up) and whether it is far enough down to.
  const listProps = useMemo(
    () =>
      panelListProps && {
        ...panelListProps,
        // Room under the last row for the Top button, so the row scrolls clear above it rather than sitting under it.
        contentContainerStyle: {
          ...panelListProps.contentContainerStyle,
          paddingBottom: empty
            ? panelListProps.contentContainerStyle.paddingBottom
            : Math.max(panelListProps.contentContainerStyle.paddingBottom, topButtonBottom + TOP_BUTTON_HEIGHT + TOP_BUTTON_GAP),
        },
        onLayout: (e: Parameters<typeof panelListProps.onLayout>[0]) => {
          panelListProps.onLayout(e);
          setViewportHeight(e.nativeEvent.layout.height);
        },
        ref: (l: FlashListRef<MapItemSnapshot> | null) => {
          list.current = l;
          panelListProps.ref(l);
        },
        onScroll: (e: Parameters<typeof panelListProps.onScroll>[0]) => {
          panelListProps.onScroll(e);
          setFarDown(e.nativeEvent.contentOffset.y > BACK_TO_TOP_AFTER);
        },
      },
    [panelListProps, topButtonBottom, empty],
  );
  const tabOptions = TABS.map((t) => ({
    value: t.id,
    label: t.label,
    icon: (
      <View testID={`layers-tab-${t.id}`} className="flex-row items-baseline gap-1.5">
        <Text className={`text-sm font-semibold ${t.id === tab ? 'text-accent' : 'text-text'}`}>{t.short}</Text>
        <Text className={`font-mono text-xs ${t.id === tab ? 'text-accent' : 'text-text-muted'}`}>{tabCount(byTab[t.id])}</Text>
      </View>
    ),
  }));

  // The ring column shows on the Units tab once any unit there has a ring distance.
  const ringColumn = tab === 'unit' && ringableIds.length > 0;
  const noun = affiliation ? AFFILIATION_LABELS[affiliation].toLowerCase() : total === 1 ? tabInfo.one : tabInfo.noun;
  const listCount = query.trim() ? `${count(matched)} of ${count(total)} ${noun}` : `${count(total)} ${noun}`;

  const toggleSearch = () => {
    if (searchOpen) {
      setQuery('');
      setSearchOpen(false);
      Keyboard.dismiss();
    } else {
      setFocusSearch(true);
      setSearchOpen(true);
    }
  };

  // Stable, so a row redraws only when its own item, visibility or ring changes.
  const toggle = useCallback(
    (id: string, hide: boolean) => {
      void setItemHidden(ctx, id, hide).then((r) => {
        if (!r.ok) notifyError('Could not change visibility.');
      });
    },
    [ctx],
  );
  const hideAll = () => {
    void setItemsHidden(ctx, visibleIds, true).then((r) => {
      if (!r.ok) notifyError('Could not hide the items.');
    });
  };
  const showAll = () => {
    void setItemsHidden(ctx, hiddenIds, false).then((r) => {
      if (!r.ok) notifyError('Could not show the hidden items.');
    });
  };

  const toggleRing = useCallback(
    (id: string, show: boolean) => {
      void setItemShowRing(ctx, id, show).then((r) => {
        if (!r.ok) notifyError('Could not change the range ring.');
      });
    },
    [ctx],
  );
  const showAllRings = () => {
    void setItemsShowRing(ctx, ringableIds, true).then((r) => {
      if (!r.ok) notifyError('Could not show the range rings.');
    });
  };
  const hideAllRings = () => {
    void setItemsShowRing(ctx, ringOnIds, false).then((r) => {
      if (!r.ok) notifyError('Could not hide the range rings.');
    });
  };

  const controls = (
    <View>
      <MenuHeader
        title="Layers"
        leading={{ label: 'Close', icon: 'close', iconOnly: true, onPress: close }}
        trailing={
          total > 0 || searchOpen
            ? { label: searchOpen ? 'Close search' : 'Open search', icon: 'magnify', iconOnly: true, active: searchOpen, onPress: toggleSearch }
            : undefined
        }
      />
      {/* A section whose last gap, under the counts, is the rows' own (they follow in the list). */}
      <View onLayout={(e) => setSectionTop(e.nativeEvent.layout.y)} className="gap-2 px-4 pb-2">
        <MenuSegmented<ItemCategory>
          options={tabOptions}
          value={tab}
          onChange={(t) => {
            useLayersView.getState().setTab(t);
            setQuery('');
          }}
        />
        {tab === 'unit' && !empty ? (
          <UnitFilterChips all={byTab.unit} counts={byAffiliation} value={affiliation} onChange={(a) => useLayersView.getState().setUnitAffiliation(a)} />
        ) : null}
        {searchOpen && total > 0 ? (
          <TextField
            icon="magnify"
            clearable
            autoFocus={focusSearch}
            accessibilityLabel="Search"
            value={query}
            onChangeText={setQuery}
            placeholder={`Search ${tabInfo.noun}`}
            autoCapitalize="characters"
            autoCorrect={false}
          />
        ) : null}
        {/*
          Column headers act on the whole tab (not narrowed by search), like a "select all" box: while anything is off,
          a tap turns everything on; once everything is on, a tap turns everything off.
        */}
        {total > 0 ? (
          <View className="flex-row items-center gap-1 pt-1">
            <Text testID="layers-count" className="mr-auto text-xs font-semibold uppercase tracking-widest text-text-muted">
              {listCount}
              {/* A chip narrows the tab: how many units there are in all, in quieter type. */}
              {affiliation && !query.trim() ? <Text className="font-normal normal-case tracking-normal">{` of ${count(byTab.unit)}`}</Text> : null}
            </Text>
            {ringColumn ? (
              <MenuCountButton
                icon={RING_ICON}
                accent
                text={`${count(ringOnIds.length)}/${count(ringableIds.length)}`}
                label={ringOnIds.length < ringableIds.length ? 'Show all rings' : 'Hide all rings'}
                onPress={ringOnIds.length < ringableIds.length ? showAllRings : hideAllRings}
              />
            ) : null}
            <MenuCountButton
              icon="eye-outline"
              text={`${count(visibleIds.length)}/${count(total)}`}
              label={hiddenIds.length > 0 ? 'Show all' : 'Hide all'}
              onPress={hiddenIds.length > 0 ? showAll : hideAll}
            />
          </View>
        ) : null}
        {empty ? (
          <EmptyLayer
            icon={tabInfo.icon}
            title={`No ${tabInfo.noun} yet`}
            // Broken in the same place on every tab, so the box looks the same on each (Polygons would wrap alone).
            body={`${tabInfo.label} you add to the map\nwill be listed here.`}
            // Down to the panel's bottom padding, less this section's own (pb-2).
            minHeight={Math.max(EMPTY_MIN_HEIGHT, viewportHeight - sectionTop - emptyTop - (panelListProps?.contentContainerStyle.paddingBottom ?? 0) - 8)}
            onTop={setEmptyTop}
          />
        ) : null}
        {total > 0 && matched === 0 ? <Text className="text-sm text-text-muted">Nothing matches.</Text> : null}
      </View>
    </View>
  );

  const renderItem = ({ item }: { item: MapItemSnapshot }) => (
    <LayerListRow
      row={layerRow(item, hiddenSet, ringOnSet)}
      ringColumn={ringColumn}
      coordinateFormat={coordinateFormat}
      onToggle={toggle}
      onToggleRing={toggleRing}
    />
  );

  // Inside the panel (always, in the app) the list is its scroller; drawn alone (a test), it lays out every row.
  return (
    <View style={{ flex: 1 }}>
      <FlashList
        {...listProps}
        data={matches}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        // A row also redraws when its visibility, ring or the coordinate format changes.
        extraData={[hiddenSet, ringOnSet, ringColumn, coordinateFormat]}
        ListHeaderComponent={controls}
        // Kept off: when rows come back above the first one shown (a chip back to All), FlashList would scroll to keep
        // that row in place, pushing the tabs and chips up. A list sorted by name has nothing worth holding in place.
        maintainVisibleContentPosition={{ disabled: true }}
        keyboardDismissMode="on-drag"
      />
      {farDown ? (
        // A small pill centred over the rows, low by the screen edge.
        <View
          pointerEvents="box-none"
          style={{ position: 'absolute', left: 0, right: 0, bottom: topButtonBottom }}
          className="items-center">
          <Pressable
            testID="layers-back-to-top"
            accessibilityRole="button"
            accessibilityLabel="Back to top"
            onPress={() => list.current?.scrollToOffset({ offset: 0, animated: true })}
            hitSlop={8}
            style={{ height: TOP_BUTTON_HEIGHT, boxShadow: TOP_BUTTON_SHADOW }}
            className="flex-row items-center gap-1.5 rounded-full border border-border bg-surface-raised px-4 active:opacity-60">
            <Icon name="arrow-collapse-up" size={18} color={colors.accent} />
            <Text className="font-mono-bold text-sm text-text">Top</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

/** How many units of each affiliation (units the app does not class, like suspect, count only under All). */
function affiliationCounts(items: readonly MapItemSnapshot[]): Record<Affiliation, number> {
  const counts = { ...NO_AFFILIATION_COUNTS };
  for (const i of items) {
    if (itemCategory(i) !== 'unit' || i.sidc === null) continue;
    const a = affiliationOf(i.sidc);
    if (a) counts[a] += 1;
  }
  return counts;
}

/**
 * The Units tab's filter: All, then one chip per affiliation showing its frame and count. One at a time; a chip with no
 * units is dimmed and cannot be chosen. The chosen chip is outlined and filled in amber, like the chosen tab above it.
 */
function UnitFilterChips({ all, counts, value, onChange }: { all: number; counts: Record<Affiliation, number>; value: Affiliation | null; onChange: (a: Affiliation | null) => void }) {
  const chips: { key: string; affiliation: Affiliation | null; count: number; label: string }[] = [
    { key: 'all', affiliation: null, count: all, label: 'All' },
    ...CHIP_AFFILIATIONS.map((a) => ({ key: a, affiliation: a, count: counts[a], label: AFFILIATION_LABELS[a] })),
  ];
  return (
    <View testID="layers-unit-filter" className="flex-row gap-1.5">
      {chips.map((chip) => {
        const selected = chip.affiliation === value;
        const disabled = chip.count === 0 && !selected;
        return (
          <Pressable
            key={chip.key}
            testID={`layers-chip-${chip.key}`}
            accessibilityRole="button"
            accessibilityLabel={`${chip.label}, ${chip.count} ${chip.count === 1 ? 'unit' : 'units'}`}
            accessibilityState={{ selected, disabled }}
            disabled={disabled}
            onPress={() => onChange(chip.affiliation)}
            hitSlop={{ top: 4, bottom: 4 }}
            className={`h-9 flex-1 flex-row items-center justify-center gap-1.5 rounded-full border active:opacity-60 ${selected ? 'border-accent bg-accent-subtle' : 'border-border'} ${disabled ? 'opacity-40' : ''}`}>
            {chip.affiliation ? (
              <SymbolImage sidc={composeSidc(chip.affiliation, 'unspecified')} width={18} height={16} />
            ) : (
              <Text className={`text-sm font-semibold ${selected ? 'text-accent' : 'text-text'}`}>All</Text>
            )}
            <Text className={`font-mono text-xs ${selected ? 'text-accent' : 'text-text-muted'}`}>{count(chip.count)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** A tab with nothing in it: a dashed box with the tab's tool icon (and a plus) over what will be listed there. */
function EmptyLayer({ icon, title, body, minHeight, onTop }: { icon: IconName; title: string; body: string; minHeight: number; onTop: (y: number) => void }) {
  const { colors } = useTheme();
  return (
    <View
      testID="layers-empty"
      onLayout={(e) => onTop(e.nativeEvent.layout.y)}
      style={{ minHeight }}
      className="items-center justify-center gap-3 rounded-2xl border border-dashed border-border p-6">
      <View className="mb-1 h-24 w-24 items-center justify-center rounded-full border border-border bg-surface-raised">
        <Icon testID="layers-empty-icon" name={icon} size={32} color={colors['text-muted']} />
        <View className="absolute -bottom-1 -right-1 h-9 w-9 items-center justify-center rounded-full border-2 border-surface bg-accent">
          <Icon testID="layers-empty-plus" name="plus" size={22} color={colors['on-accent']} />
        </View>
      </View>
      <Text className="text-center text-2xl font-bold text-text">
        {title}
      </Text>
      <Text className="text-center text-base text-text-muted">{body}</Text>
    </View>
  );
}

type RowProps = {
  row: LayerRow;
  ringColumn: boolean;
  coordinateFormat: CoordinateFormat;
  onToggle: (id: string, hide: boolean) => void;
  onToggleRing: (id: string, show: boolean) => void;
};

/** One item in the list; one gapless list, rows split by their own top line. Redraws only when its own props change. */
const LayerListRow = memo(
  function LayerListRow({ row, ringColumn, coordinateFormat, onToggle, onToggleRing }: RowProps) {
    return (
      <View className="px-4">
        <MenuListItem
          title={row.name}
          subtitle={`${
            row.lineType
              ? `${lineTypeInfo(row.lineType).label} · ${formatDistance(row.length ?? 0)}`
              : row.polygonType
                ? `${polygonTypeInfo(row.polygonType).label} · ${
                    row.radiusM !== null ? `r ${formatDistance(row.radiusM)}` : row.areaM2 !== null ? formatArea(row.areaM2) : '—'
                  }`
                : row.coord
                  ? formatCoordinate(row.coord, coordinateFormat)
                  : '—'
          }`}
          dimmed={row.hidden}
          leading={
            row.polygonType ? (
              <View style={{ width: 28, height: 20, justifyContent: 'center', alignItems: 'center' }}>
                <PolygonSample polygonType={row.polygonType} />
              </View>
            ) : row.lineType ? (
              <View style={{ width: 28, height: 20, justifyContent: 'center' }}>
                <LineSample lineType={row.lineType} />
              </View>
            ) : (
              <SymbolImage sidc={row.sidc} width={28} height={20} />
            )
          }
          onPress={() => {
            Keyboard.dismiss();
            openItemMenu(row.id, { kind: row.kind, sidc: row.sidc }, { drill: true });
          }}
          secondary={
            !ringColumn
              ? undefined
              : row.ring === null
                ? null
                : {
                    icon: RING_ICON,
                    active: row.ring,
                    label: row.ring ? `Hide ring for ${row.name}` : `Show ring for ${row.name}`,
                    onPress: () => onToggleRing(row.id, !row.ring),
                  }
          }
          trailing={{
            icon: row.hidden ? 'eye-off-outline' : 'eye-outline',
            label: row.hidden ? `Show ${row.name}` : `Hide ${row.name}`,
            onPress: () => onToggle(row.id, !row.hidden),
          }}
        />
      </View>
    );
  },
  // A row is rebuilt on every list render; it only needs drawing again when what it shows changed.
  (a, b) =>
    a.ringColumn === b.ringColumn &&
    a.coordinateFormat === b.coordinateFormat &&
    a.onToggle === b.onToggle &&
    a.onToggleRing === b.onToggleRing &&
    (Object.keys(a.row) as (keyof LayerRow)[]).every((k) => a.row[k] === b.row[k] || (k === 'coord' && a.row.coord?.lat === b.row.coord?.lat && a.row.coord?.lon === b.row.coord?.lon)),
);

export const layersMenu = defineMenu({ id: 'layers', family: 'app', title: 'Layers', icon: 'layers-outline', component: LayersMenu, ownScroll: true, growOnly: true });
