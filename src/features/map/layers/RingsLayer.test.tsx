import { act, waitFor } from '@testing-library/react-native';

import { placePoint, setItemHidden, setItemShowRing } from '@/features/map-items/commands';
import { hiddenFilter } from '@/features/map-items/selectors';
import { composeSidc } from '@/features/symbology/presets';
import { makeTestContext } from '@/lib/db/test-database';
import { mapboxMock } from '@/test-utils/mapbox-mock';
import { renderWithProviders } from '@/test-utils/render';

import { RingsLayer } from './RingsLayer';

jest.mock('@rnmapbox/maps');

async function setup() {
  const ctx = makeTestContext();
  const r = await placePoint(ctx, {
    missionId: 'm1',
    coord: { lat: 38.9, lon: -77 },
    sidc: composeSidc('hostile', 'artillery'),
    name: 'A',
    ranges: { threatRangeM: 18000 },
  });
  if (!r.ok) throw new Error('setup');
  return { ctx, id: r.value.id };
}

describe('RingsLayer', () => {
  it('filters to rings that are switched on, on all three layers', async () => {
    const { ctx, id } = await setup();
    await renderWithProviders(<RingsLayer missionId="m1" />, ctx);
    const props = mapboxMock().__props;
    await waitFor(() => expect(props.FillLayer['rings-fill']).toBeDefined());
    expect(JSON.stringify(props.FillLayer['rings-fill'].filter)).not.toContain(id);
    await act(async () => void (await setItemShowRing(ctx, id, true)));
    for (const layer of [props.FillLayer['rings-fill'], props.LineLayer['rings-halo'], props.LineLayer['rings-line']]) {
      await waitFor(() => expect(JSON.stringify(layer.filter)).toContain(id));
    }
  });

  it('hides hidden units and is not tappable', async () => {
    const { ctx, id } = await setup();
    await act(async () => void (await setItemHidden(ctx, id, true)));
    await renderWithProviders(<RingsLayer missionId="m1" />, ctx);
    const props = mapboxMock().__props;
    await waitFor(() => expect(JSON.stringify(props.FillLayer['rings-fill'].filter)).toContain(JSON.stringify(hiddenFilter([id]))));
    expect(props.ShapeSource.rings.onPress).toBeUndefined();
  });
});
