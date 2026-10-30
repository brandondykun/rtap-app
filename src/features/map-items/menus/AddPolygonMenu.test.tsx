import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { firstValueFrom } from 'rxjs';

import { mgrsFieldsFor } from '@/components/menu/mgrs-fields';
import { makeTestContext } from '@/lib/db/test-database';
import { INITIAL_DRAFT, useDraft } from '@/stores/draft';
import { INITIAL_INTERACTION, useInteraction } from '@/stores/interaction';
import { INITIAL_MENU, useMenu } from '@/stores/menu';
import { selectOptionLabels } from '@/test-utils/menu-select';
import { renderWithProviders } from '@/test-utils/render';

import { parsePolygonGeometry } from '../geometry';
import { observeMissionItems } from '../repository';
import { AddPolygonMenu } from './AddPolygonMenu';

const C = { lat: 38.9, lon: -77 };
const p = (n: number) => ({ lat: 38.9 + n / 100, lon: -77 + (n % 2) / 100 });

beforeEach(() => {
  useDraft.setState(INITIAL_DRAFT);
  useMenu.setState(INITIAL_MENU);
  useInteraction.setState(INITIAL_INTERACTION);
  useInteraction.getState().setCamera({ center: C, zoom: 14, bearing: 0 });
  useMenu.getState().openMenu('polygon.add', {});
});

async function open(ctx = makeTestContext()) {
  await renderWithProviders(<AddPolygonMenu params={{}} missionId="m1" />, ctx);
  expect(screen.getByRole('header')).toHaveTextContent('Add polygon');
  return ctx;
}
const items = (ctx: ReturnType<typeof makeTestContext>) => firstValueFrom(observeMissionItems(ctx.db, 'm1'));

describe('AddPolygonMenu', () => {
  it('saves a points polygon once it has a name and 3 points, and blocks removal at 3', async () => {
    const ctx = await open();
    await act(async () => {
      for (const n of [0, 1]) useDraft.getState().addVertex(p(n));
    });
    await fireEvent.changeText(screen.getByLabelText('Name'), 'IRON');
    expect(screen.getByLabelText('Save')).toBeDisabled();
    await act(async () => useDraft.getState().addVertex(p(2)));
    expect(screen.getByLabelText('Remove point 1')).toBeDisabled();
    expect(screen.getByText('A polygon needs at least 3 points')).toBeTruthy();
    expect(screen.getByText(/km² *$|m² *$/)).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Save'));
    await waitFor(async () => expect(await items(ctx)).toHaveLength(1));
    const [item] = await items(ctx);
    expect(item).toMatchObject({ kind: 'polygon', name: 'IRON', style: '{"polygonType":"objective","shape":"points"}' });
    expect(parsePolygonGeometry(item.geometry)).toHaveLength(3);
    expect(useMenu.getState().stack).toEqual([{ id: 'polygon.edit', params: { itemId: item.id } }]);
  });

  it('saves the fill picked from the 5 Fill options (15% to start)', async () => {
    const ctx = await open();
    for (const label of ['0%', '15%', '30%', '50%', '75%']) expect(screen.getByLabelText(label)).toBeTruthy();
    expect(screen.getByLabelText('15%')).toBeSelected();
    await act(async () => {
      for (const n of [0, 1, 2]) useDraft.getState().addVertex(p(n));
    });
    await fireEvent.changeText(screen.getByLabelText('Name'), 'IRON');
    await fireEvent.press(screen.getByLabelText('50%'));
    expect(screen.getByLabelText('50%')).toBeSelected();
    await fireEvent.press(screen.getByLabelText('Save'));
    await waitFor(async () => expect(await items(ctx)).toHaveLength(1));
    expect(JSON.parse((await items(ctx))[0].style!)).toMatchObject({ fill: 'heavy' });
  });

  it('shows Inserting points while inserting after a point, and Done ends it', async () => {
    await open();
    await act(async () => {
      for (const n of [0, 1, 2]) useDraft.getState().addVertex(p(n));
    });
    await fireEvent.press(screen.getByLabelText(/^Point 2,/));
    expect(screen.queryByText('Inserting points')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Insert after point 2'));
    expect(screen.getByText('Inserting points')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Done inserting points'));
    expect(useDraft.getState()).toMatchObject({ selectedVertex: null, insertAfter: null });
    expect(screen.queryByText('Inserting points')).toBeNull();
  });

  it('prefills zone and square from the map center, then from each typed point, and from the center again on deselect', async () => {
    await open();
    const fields = () => ['MGRS zone', '100 km square', 'Easting', 'Northing'].map((l) => screen.getByLabelText(l).props.value);
    const square = (at: { lat: number; lon: number }) => {
      const g = mgrsFieldsFor(at);
      return [g.zoneBand, g.square, '', ''];
    };
    expect(fields()).toEqual(square(C));
    const far = { lat: 40.5, lon: -75 };
    const g = mgrsFieldsFor(far);
    await fireEvent.changeText(screen.getByLabelText('MGRS zone'), `${g.zoneBand} ${g.square} ${g.easting} ${g.northing}`);
    await fireEvent.press(screen.getByLabelText('Add new point'));
    expect(fields()).toEqual(square(far));
    await fireEvent.press(screen.getByLabelText(/^Point 1,/));
    await fireEvent.press(screen.getByLabelText(/^Point 1,/));
    expect(fields()).toEqual(square(C));
  });

  it('saves a circle from the crosshair center and a typed radius in km; bad radii keep Save off', async () => {
    const ctx = await open();
    await fireEvent.changeText(screen.getByLabelText('Name'), '1');
    await fireEvent.press(screen.getByLabelText('Circle'));
    await fireEvent.press(screen.getByLabelText('Center'));
    for (const bad of ['', '0', '-3', 'abc']) {
      await fireEvent.changeText(screen.getByLabelText('Radius'), bad);
      expect(screen.getByLabelText('Save')).toBeDisabled();
    }
    await fireEvent.press(screen.getByLabelText('km'));
    await fireEvent.changeText(screen.getByLabelText('Radius'), '1.5');
    expect(useDraft.getState().circleRadiusM).toBe(1500);
    await fireEvent.press(screen.getByLabelText('Save'));
    await waitFor(async () => expect(await items(ctx)).toHaveLength(1));
    expect(JSON.parse((await items(ctx))[0].style!)).toEqual({ polygonType: 'objective', shape: 'circle', center: C, radiusM: 1500 });
  });

  it('keeps the points while switching to Circle and back, and saves only the shape showing', async () => {
    const ctx = await open();
    await act(async () => {
      for (const n of [0, 1, 2]) useDraft.getState().addVertex(p(n));
    });
    await fireEvent.changeText(screen.getByLabelText('Name'), 'IRON');
    await fireEvent.press(screen.getByLabelText('Circle'));
    expect(screen.queryByText('POINTS · 3')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Points'));
    expect(screen.getByText('POINTS · 3')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Save'));
    await waitFor(async () => expect(await items(ctx)).toHaveLength(1));
    expect(JSON.parse((await items(ctx))[0].style!).shape).toBe('points');
  });

  it('shows no elevation for a circle center (units and points only)', async () => {
    await open();
    await fireEvent.press(screen.getByLabelText('Circle'));
    expect(screen.getByLabelText('Center')).toBeTruthy();
    expect(screen.queryByLabelText(/^Elevation/)).toBeNull();
  });

  it('fills the next name for the polygon type', async () => {
    await open();
    await waitFor(() => expect(screen.getByLabelText('Name')).toHaveProp('value', 'OBJ-1'));
  });

  it('lists polygon types alphabetically', async () => {
    await open();
    await fireEvent.press(screen.getByLabelText('Polygon type: Objective'));
    expect(selectOptionLabels()).toEqual([
      'Airspace coordination area',
      'Assembly area',
      'Battle position',
      'Engagement area',
      'Free fire area',
      'Impact area',
      'Named area of interest',
      'No fire area',
      'Objective',
      'Restrictive fire area',
      'Target area of interest',
    ]);
  });


  it('accepts a decimal comma and converts the radius when switching m/km', async () => {
    await open();
    await fireEvent.press(screen.getByLabelText('Circle'));
    await fireEvent.press(screen.getByLabelText('km'));
    await fireEvent.changeText(screen.getByLabelText('Radius'), '1,5');
    expect(useDraft.getState().circleRadiusM).toBe(1500);
    await fireEvent.press(screen.getByLabelText('m'));
    expect(screen.getByLabelText('Radius')).toHaveDisplayValue('1500');
    expect(useDraft.getState().circleRadiusM).toBe(1500);
  });
});
