import { useMemo, useState } from 'react';
import { Keyboard, Text, View } from 'react-native';

import { MenuCountButton } from '@/components/menu/MenuCountButton';
import { MenuHeader } from '@/components/menu/MenuHeader';
import { MenuListItem } from '@/components/menu/MenuListItem';
import { MenuSection } from '@/components/menu/MenuSection';
import { MenuSegmented } from '@/components/menu/MenuSegmented';
import { TextField } from '@/components/ui/TextField';
import { notifyError } from '@/features/feedback/feedback';
import { formatCoordinate } from '@/features/map/interaction/readout';
import { defineMenu, type MenuComponentProps } from '@/features/menus/define-menu';
import { useMenuEntryState } from '@/features/menus/menu-entry-memory';
import type { ItemCategory } from '@/features/symbology/categories';
import { lineTypeInfo } from '@/features/symbology/line-types';
import { polygonTypeInfo } from '@/features/symbology/polygon-types';
import { SymbolImage } from '@/features/symbology/SymbolImage';
import { useObservable } from '@/hooks/use-observable';
import { useCommandContext } from '@/lib/db/command-context-provider';
import { formatDistance } from '@/lib/geo/format/measure';
import { useLayersView } from '@/stores/layers-view';
import { useMenu } from '@/stores/menu';
import { useSettings } from '@/stores/settings';

import { setItemHidden, setItemShowRing, setItemsHidden, setItemsShowRing } from '../commands';
import { layerRows } from '../layer-rows';
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
const TABS: { id: ItemCategory; label: string; short: string; one: string; noun: string; empty: string }[] = [
  { id: 'unit', label: 'Units', short: 'Units', one: 'unit', noun: 'units', empty: 'No units yet. Use UNIT or long-press the map.' },
  { id: 'point', label: 'Points', short: 'Points', one: 'point', noun: 'points', empty: 'No points yet. Use POINT to add one.' },
  { id: 'line', label: 'Lines', short: 'Lines', one: 'line', noun: 'lines', empty: 'No lines yet. Use LINE to draw one.' },
  { id: 'polygon', label: 'Polygons', short: 'Polys', one: 'polygon', noun: 'polygons', empty: 'No polygons yet. Use POLYGON to draw one.' },
];
const RING_ICON = 'record-circle-outline';

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
  const counts = useMemo(() => layerRows(items, hidden, '', 0), [items, hidden]);
  const byTab: Record<ItemCategory, number> = { unit: counts.units, point: counts.points, line: counts.lines, polygon: counts.polygons };
  // The tab chosen last; until then the first tab that has items.
  const tab = chosenTab ?? TABS.find((t) => byTab[t.id] > 0)?.id ?? 'unit';
  const tabInfo = TABS.find((t) => t.id === tab)!;
  const { rows, matched, total, hiddenIds, visibleIds, ringableIds, ringOnIds } = useMemo(
    () => layerRows(items, hidden, query, undefined, tab, ringIds),
    [items, hidden, query, tab, ringIds],
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
  const noun = total === 1 ? tabInfo.one : tabInfo.noun;
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

  const toggle = (id: string, hide: boolean) => {
    void setItemHidden(ctx, id, hide).then((r) => {
      if (!r.ok) notifyError('Could not change visibility.');
    });
  };
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

  const toggleRing = (id: string, show: boolean) => {
    void setItemShowRing(ctx, id, show).then((r) => {
      if (!r.ok) notifyError('Could not change the range ring.');
    });
  };
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

  return (
    <View>
      <MenuHeader
        title="Layers"
        leading={{ label: 'Close', onPress: close }}
        trailing={
          total > 0 || searchOpen
            ? { label: searchOpen ? 'Close search' : 'Open search', icon: 'magnify', iconOnly: true, active: searchOpen, onPress: toggleSearch }
            : undefined
        }
      />
      <MenuSection>
        <MenuSegmented<ItemCategory>
          options={tabOptions}
          value={tab}
          onChange={(t) => {
            useLayersView.getState().setTab(t);
            setQuery('');
          }}
        />
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
        {total === 0 ? <Text className="text-sm text-text-muted">{tabInfo.empty}</Text> : null}
        {total > 0 && matched === 0 ? <Text className="text-sm text-text-muted">Nothing matches.</Text> : null}
        {/* One gapless list: rows are split by their own top line. */}
        <View>
          {rows.map((row) => (
            <MenuListItem
              key={row.id}
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
                        onPress: () => toggleRing(row.id, !row.ring),
                      }
              }
              trailing={{
                icon: row.hidden ? 'eye-off-outline' : 'eye-outline',
                label: row.hidden ? `Show ${row.name}` : `Hide ${row.name}`,
                onPress: () => toggle(row.id, !row.hidden),
              }}
            />
          ))}
        </View>
        {matched > rows.length ? (
          <Text testID="layers-more" className="text-sm text-text-muted">
            {`Showing ${count(rows.length)} of ${count(matched)} — refine your search`}
          </Text>
        ) : null}
      </MenuSection>
    </View>
  );
}

export const layersMenu = defineMenu({ id: 'layers', family: 'app', title: 'Layers', icon: 'layers-outline', component: LayersMenu });
