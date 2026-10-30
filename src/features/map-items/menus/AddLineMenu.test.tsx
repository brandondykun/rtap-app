import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { firstValueFrom } from 'rxjs';

import { mgrsFieldsFor } from '@/components/menu/mgrs-fields';
import { makeTestContext } from '@/lib/db/test-database';
import { INITIAL_DRAFT, useDraft } from '@/stores/draft';
import { INITIAL_INTERACTION, useInteraction } from '@/stores/interaction';
import { INITIAL_MENU, useMenu } from '@/stores/menu';
import { selectOptionLabels } from '@/test-utils/menu-select';
import { renderWithProviders } from '@/test-utils/render';

import { parseLineGeometry } from '../geometry';
import { placeLine } from '../commands';
import { observeMissionItems } from '../repository';
import { AddLineMenu } from './AddLineMenu';

const p = (n: number) => ({ lat: 38.9 + n / 100, lon: -77 });
/** The map center, and a point in another grid zone (18T, not 18S). */
const CENTER = { lat: 38.9, lon: -77 };
const FAR = { lat: 40.5, lon: -75 };

beforeEach(() => {
  useDraft.setState(INITIAL_DRAFT);
  useInteraction.setState(INITIAL_INTERACTION);
  useInteraction.getState().setCamera({ center: CENTER, zoom: 14, bearing: 0 });
  useMenu.setState(INITIAL_MENU);
  useMenu.getState().openMenu('line.add', {});
});

async function open(ctx = makeTestContext()) {
  await renderWithProviders(<AddLineMenu params={{}} missionId="m1" />, ctx);
  expect(screen.getByRole('header')).toHaveTextContent('Add line');
  return ctx;
}

const typeGrid = async (at: { lat: number; lon: number }) => {
  const g = mgrsFieldsFor(at);
  await fireEvent.changeText(screen.getByLabelText('MGRS zone'), `${g.zoneBand} ${g.square} ${g.easting} ${g.northing}`);
  await fireEvent.press(screen.getByLabelText('Add new point'));
};

describe('AddLineMenu', () => {
  it('enables Save only with a name and 2 points, then saves and shows the line', async () => {
    const ctx = await open();
    expect(screen.getByLabelText('Save')).toBeDisabled();
    await act(async () => {
      useDraft.getState().addVertex(p(0));
      useDraft.getState().addVertex(p(1));
    });
    expect(screen.getByText('POINTS · 2')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Name'), '');
    expect(screen.getByLabelText('Save')).toBeDisabled();
    await fireEvent.changeText(screen.getByLabelText('Name'), 'RED');
    await fireEvent.press(screen.getByLabelText('Line type: Phase line'));
    await fireEvent.press(screen.getByText('Route'));
    await fireEvent.press(screen.getByLabelText('Save'));
    await waitFor(async () => expect(await firstValueFrom(observeMissionItems(ctx.db, 'm1'))).toHaveLength(1));
    const [item] = await firstValueFrom(observeMissionItems(ctx.db, 'm1'));
    expect(item).toMatchObject({ kind: 'line', name: 'RED', style: '{"lineType":"route"}' });
    expect(parseLineGeometry(item.geometry)).toHaveLength(2);
    expect(useMenu.getState().stack).toEqual([{ id: 'line.edit', params: { itemId: item.id } }]);
  });

  it('fills the next name for the line type and follows a type change', async () => {
    const ctx = makeTestContext();
    await placeLine(ctx, { missionId: 'm1', points: [p(0), p(1)], lineType: 'phase-line', name: 'PL-1' });
    await open(ctx);
    await waitFor(() => expect(screen.getByLabelText('Name')).toHaveProp('value', 'PL-2'));
    await fireEvent.press(screen.getByLabelText('Line type: Phase line'));
    await fireEvent.press(screen.getByText('Boundary'));
    await waitFor(() => expect(screen.getByLabelText('Name')).toHaveProp('value', 'BDY-1'));
  });

  it('adds typed grids, refuses partial ones, and moves a selected point', async () => {
    await open();
    expect(screen.getByText('New point')).toBeTruthy();
    await typeGrid(p(0));
    await typeGrid(p(1));
    expect(useDraft.getState().vertices).toHaveLength(2);
    await fireEvent.changeText(screen.getByLabelText('Northing'), '07');
    expect(screen.getByLabelText('Add new point')).toBeDisabled();
    await fireEvent.press(screen.getByLabelText(/^Point 1,/));
    expect(screen.getByLabelText('Move point 1 to typed grid')).toBeTruthy();
    await typeGridAs(p(5), 'Move point 1 to typed grid');
    expect(useDraft.getState().vertices[0].lat).toBeCloseTo(p(5).lat, 3);
  });

  it('prefills zone and square from the map center, then from each typed point, and from the center again on deselect', async () => {
    await open();
    const fields = () => ['MGRS zone', '100 km square', 'Easting', 'Northing'].map((l) => screen.getByLabelText(l).props.value);
    const square = (at: { lat: number; lon: number }) => {
      const g = mgrsFieldsFor(at);
      return [g.zoneBand, g.square, '', ''];
    };
    expect(fields()).toEqual(square(CENTER));
    await typeGrid(FAR);
    expect(fields()).toEqual(square(FAR));
    await fireEvent.press(screen.getByLabelText(/^Point 1,/));
    await fireEvent.press(screen.getByLabelText(/^Point 1,/));
    expect(fields()).toEqual(square(CENTER));
  });

  it('blocks removing below 2 points and shows the hint', async () => {
    await open();
    await act(async () => {
      useDraft.getState().addVertex(p(0));
      useDraft.getState().addVertex(p(1));
    });
    expect(screen.getByLabelText('Remove point 1')).toBeDisabled();
    expect(screen.getByText('A line needs at least 2 points')).toBeTruthy();
  });

  it('inserts after a selected point', async () => {
    await open();
    await act(async () => {
      for (const n of [0, 1, 2]) useDraft.getState().addVertex(p(n));
    });
    await fireEvent.press(screen.getByLabelText(/^Point 1,/));
    await fireEvent.press(screen.getByLabelText('Insert after point 1'));
    expect(screen.getByText('Inserting points')).toBeTruthy();
    await act(async () => useDraft.getState().addVertex(p(9)));
    expect(useDraft.getState().vertices).toEqual([p(0), p(9), p(1), p(2)]);
    // The indicator follows the new point, and Done goes back to adding at the end.
    expect(screen.getByLabelText(/^Point 2,/)).toBeSelected();
    await fireEvent.press(screen.getByLabelText('Done inserting points'));
    expect(useDraft.getState()).toMatchObject({ selectedVertex: null, insertAfter: null });
    expect(screen.queryByText('Inserting points')).toBeNull();
    await act(async () => useDraft.getState().addVertex(p(8)));
    expect(useDraft.getState().vertices).toEqual([p(0), p(9), p(1), p(2), p(8)]);
  });
  it('lists line types alphabetically', async () => {
    await open();
    await fireEvent.press(screen.getByLabelText('Line type: Phase line'));
    expect(selectOptionLabels()).toEqual([
      'Axis of advance',
      'Boundary',
      'Coordinated fire line',
      'Fire support coordination line',
      'Forward line of own troops',
      'Limit of advance',
      'Line of departure',
      'Phase line',
      'Restrictive fire line',
      'Route',
    ]);
  });
});

async function typeGridAs(at: { lat: number; lon: number }, button: string) {
  const g = mgrsFieldsFor(at);
  await fireEvent.changeText(screen.getByLabelText('MGRS zone'), `${g.zoneBand} ${g.square} ${g.easting} ${g.northing}`);
  await fireEvent.press(screen.getByLabelText(button));
}
