import { useMemo, useState } from 'react';
import { Image, Keyboard, Text, View } from 'react-native';

import { MenuButton } from '@/components/menu/MenuButton';
import { MenuHeader } from '@/components/menu/MenuHeader';
import { MenuListItem } from '@/components/menu/MenuListItem';
import { MenuSection } from '@/components/menu/MenuSection';
import { MenuSegmented } from '@/components/menu/MenuSegmented';
import { TextField } from '@/components/ui/TextField';
import { notifyError } from '@/features/feedback/feedback';
import { formatCoordinate } from '@/features/map/interaction/readout';
import { defineMenu, type MenuComponentProps } from '@/features/menus/define-menu';
import { SYMBOL_IMAGES } from '@/features/symbology/symbol-images.generated';
import { useObservable } from '@/hooks/use-observable';
import { useCommandContext } from '@/lib/db/command-context-provider';
import { useMenu } from '@/stores/menu';
import { useSettings, type Basemap } from '@/stores/settings';

import { setItemHidden, setItemsHidden } from '../commands';
import { layerRows } from '../layer-rows';
import { observeHiddenItemIds, observeMissionItems, type MapItemSnapshot } from '../repository';

const BASEMAP_OPTIONS: { value: Basemap; label: string }[] = [
  { value: 'satellite', label: 'Satellite' },
  { value: 'hybrid', label: 'Hybrid' },
  { value: 'topo', label: 'Topo' },
  { value: 'dark', label: 'Dark' },
];
const NO_ITEMS: MapItemSnapshot[] = [];
const NO_IDS: string[] = [];
const count = (n: number) => n.toLocaleString('en-US');

/** Basemap choice and the mission's points: search, show/hide, tap to fly to and select. */
export function LayersMenu({ missionId }: MenuComponentProps<'layers'>) {
  const ctx = useCommandContext();
  const close = useMenu((s) => s.closeMenu);
  const openMenu = useMenu((s) => s.openMenu);
  const basemap = useSettings((s) => s.basemap);
  const setBasemap = useSettings((s) => s.setBasemap);
  const coordinateFormat = useSettings((s) => s.coordinateFormat);
  const items = useObservable(() => observeMissionItems(ctx.db, missionId), NO_ITEMS, [ctx, missionId]);
  const hidden = useObservable(() => observeHiddenItemIds(ctx.db), NO_IDS, [ctx]);
  const [query, setQuery] = useState('');
  const { rows, matched, total, hiddenIds } = useMemo(() => layerRows(items, hidden, query), [items, hidden, query]);

  const toggle = (id: string, hide: boolean) => {
    void setItemHidden(ctx, id, hide).then((r) => {
      if (!r.ok) notifyError('Could not change visibility.');
    });
  };
  const showAll = () => {
    void setItemsHidden(ctx, hiddenIds, false).then((r) => {
      if (!r.ok) notifyError('Could not show the points.');
    });
  };

  return (
    <View>
      <MenuHeader title="Layers" leading={{ label: 'Close', onPress: close }} />
      <MenuSection label="Basemap">
        <MenuSegmented<Basemap> options={BASEMAP_OPTIONS} value={basemap} onChange={setBasemap} />
        <Text className="text-xs text-text-muted">Offline map downloads use Satellite.</Text>
      </MenuSection>
      <MenuSection label="Points">
        <View className="flex-row items-center justify-between gap-3">
          <Text testID="layers-summary" className="text-sm text-text-muted">
            {`${count(total)} ${total === 1 ? 'point' : 'points'} · ${count(hiddenIds.length)} hidden`}
          </Text>
          <MenuButton label="Show all" icon="eye-outline" onPress={showAll} disabled={hiddenIds.length === 0} />
        </View>
        {total > 0 ? (
          <TextField accessibilityLabel="Search points" value={query} onChangeText={setQuery} placeholder="Search points" autoCapitalize="characters" autoCorrect={false} />
        ) : null}
        {total === 0 ? <Text className="text-sm text-text-muted">No points yet. Use POINT or long-press the map.</Text> : null}
        {total > 0 && matched === 0 ? <Text className="text-sm text-text-muted">No points match.</Text> : null}
        {rows.map((row) => (
          <MenuListItem
            key={row.id}
            title={row.name}
            subtitle={`${row.hidden ? 'Hidden · ' : ''}${row.coord ? formatCoordinate(row.coord, coordinateFormat) : '—'}`}
            dimmed={row.hidden}
            leading={<Image source={SYMBOL_IMAGES[row.sidc]} style={{ width: 28, height: 20 }} resizeMode="contain" />}
            onPress={() => {
              Keyboard.dismiss();
              openMenu('point.edit', { itemId: row.id });
            }}
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

export const layersMenu = defineMenu({ id: 'layers', family: 'app', title: 'Layers', detents: ['half', 'full'], component: LayersMenu });
