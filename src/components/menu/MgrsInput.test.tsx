import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithProviders } from '@/test-utils/render';

import { EMPTY_MGRS, evaluateMgrsFields, mgrsFieldsFor } from './mgrs-fields';
import { MgrsInput } from './MgrsInput';

const DC = { lat: 38.8977, lon: -77.0365 };

describe('MgrsInput', () => {
  it('shows the four fields and a valid status line', async () => {
    const parts = mgrsFieldsFor(DC);
    await renderWithProviders(<MgrsInput value={parts} onChange={jest.fn()} status={evaluateMgrsFields(parts)} validDetail="1.15 km @ 103° GRID" />);
    expect(screen.getByLabelText('MGRS zone')).toHaveDisplayValue(parts.zoneBand);
    expect(screen.getByLabelText('Northing')).toHaveDisplayValue(parts.northing);
    expect(screen.getByTestId('mgrs-status')).toHaveTextContent('Valid · 1.15 km @ 103° GRID');
  });

  it('uppercases letters and strips non-digits', async () => {
    const onChange = jest.fn();
    await renderWithProviders(<MgrsInput value={EMPTY_MGRS} onChange={onChange} status={{ status: 'empty' }} />);
    await fireEvent.changeText(screen.getByLabelText('100 km square'), 'uj');
    expect(onChange).toHaveBeenLastCalledWith({ ...EMPTY_MGRS, square: 'UJ' });
    await fireEvent.changeText(screen.getByLabelText('Easting'), '23 3a9');
    expect(onChange).toHaveBeenLastCalledWith({ ...EMPTY_MGRS, easting: '2339' });
  });

  it('spreads a full reference pasted into the zone field', async () => {
    const onChange = jest.fn();
    await renderWithProviders(<MgrsInput value={EMPTY_MGRS} onChange={onChange} status={{ status: 'empty' }} />);
    await fireEvent.changeText(screen.getByLabelText('MGRS zone'), '18S UJ 23394 07395');
    expect(onChange).toHaveBeenLastCalledWith({ zoneBand: '18S', square: 'UJ', easting: '23394', northing: '07395' });
  });

  it('explains an invalid reference', async () => {
    await renderWithProviders(
      <MgrsInput value={EMPTY_MGRS} onChange={jest.fn()} status={{ status: 'invalid', message: 'Grid zone does not match the square and digits' }} />,
    );
    expect(screen.getByTestId('mgrs-status')).toHaveTextContent('Grid zone does not match the square and digits');
  });

  it('submits from the northing field', async () => {
    const onSubmit = jest.fn();
    await renderWithProviders(<MgrsInput value={EMPTY_MGRS} onChange={jest.fn()} status={{ status: 'empty' }} onSubmit={onSubmit} />);
    await fireEvent(screen.getByLabelText('Northing'), 'submitEditing');
    expect(onSubmit).toHaveBeenCalled();
  });
});
