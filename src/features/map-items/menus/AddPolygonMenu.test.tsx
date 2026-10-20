import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { firstValueFrom } from 'rxjs';

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

  it('shows Inserting points while inserting after a point, and Done ends it', async () => {
    await open();
    await act(async () => {
      for (const n of [0, 1, 2]) useDraft.getState().addVertex(p(n));
    });
    await fireEvent.press(screen.getByLabelText('Point 2'));
    expect(screen.queryByText('Inserting points')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Insert after point 2'));
    expect(screen.getByText('Inserting points')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Done inserting points'));
    expect(useDraft.getState()).toMatchObject({ selectedVertex: null, insertAfter: null });
    expect(screen.queryByText('Inserting points')).toBeNull();
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
