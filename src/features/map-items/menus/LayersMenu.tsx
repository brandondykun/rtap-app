import { useMemo } from 'react';
import { Keyboard, Text, View } from 'react-native';

import { MenuButton } from '@/components/menu/MenuButton';
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

const TABS: { id: ItemCategory; label: string; noun: string; empty: string }[] = [
  { id: 'unit', label: 'Units', noun: 'units', empty: 'No units yet. Use UNIT or long-press the map.' },
  { id: 'point', label: 'Points', noun: 'points', empty: 'No points yet. Use POINT to add one.' },
  { id: 'line', label: 'Lines', noun: 'lines', empty: 'No lines yet. Use LINE to draw one.' },
  { id: 'polygon', label: 'Polygons', noun: 'polygons', empty: 'No polygons yet. Use POLYGON to draw one.' },
];

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
      <View testID={`layers-tab-${t.id}`} className="items-center">
        <Text className={`text-sm font-semibold ${t.id === tab ? 'text-accent' : 'text-text'}`}>{t.label}</Text>
        <Text className="font-mono text-xs text-text-muted">{count(byTab[t.id])}</Text>
      </View>
    ),
  }));

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
      <MenuHeader title="Layers" leading={{ label: 'Close', onPress: close }} />
      <MenuSection label="Map items">
        <MenuSegmented<ItemCategory>
          options={tabOptions}
          value={tab}
          onChange={(t) => {
            useLayersView.getState().setTab(t);
            setQuery('');
          }}
        />
        {total > 0 ? (
          <TextField
            accessibilityLabel="Search"
            value={query}
            onChangeText={setQuery}
            placeholder={`Search ${tabInfo.noun}…`}
            autoCapitalize="characters"
            autoCorrect={false}
          />
        ) : null}
        {/* Hidden count, Hide all and Show all cover this tab only (not narrowed by search). */}
        <View className="flex-row items-center gap-2">
          <Text testID="layers-hidden" className="mr-auto text-sm text-text-muted">{`${count(hiddenIds.length)} hidden`}</Text>
          <MenuButton label="Hide all" icon="eye-off-outline" onPress={hideAll} disabled={visibleIds.length === 0} />
          <MenuButton label="Show all" icon="eye-outline" onPress={showAll} disabled={hiddenIds.length === 0} />
        </View>
        {tab === 'unit' ? (
          <View className="flex-row items-center justify-end gap-2">
            <MenuButton label="Hide all rings" icon="radius-outline" onPress={hideAllRings} disabled={ringOnIds.length === 0} />
            <MenuButton label="Show all rings" icon="radius" onPress={showAllRings} disabled={ringOnIds.length >= ringableIds.length} />
          </View>
        ) : null}
        {total === 0 ? <Text className="text-sm text-text-muted">{tabInfo.empty}</Text> : null}
        {total > 0 && matched === 0 ? <Text className="text-sm text-text-muted">Nothing matches.</Text> : null}
        {rows.map((row) => (
          <MenuListItem
            key={row.id}
            title={row.name}
            subtitle={`${row.hidden ? 'Hidden · ' : ''}${
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
              row.ring === null
                ? undefined
                : {
                    icon: row.ring ? 'radius' : 'radius-outline',
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
