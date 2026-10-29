import { act, fireEvent, screen } from '@testing-library/react-native';

import { INITIAL_DRAFT, useDraft } from '@/stores/draft';
import { INITIAL_PRESENCE, usePresence } from '@/stores/presence';
import { renderWithProviders } from '@/test-utils/render';

import { LocationSection } from './LocationSection';

jest.mock('@/features/map/terrain/elevation', () => ({ elevationAt: jest.fn(async () => 126) }));

const HERE = { lat: 38.9, lon: -77.0 };
const THERE = { lat: 38.8977, lon: -77.0365 };

beforeEach(() => {
  useDraft.setState(INITIAL_DRAFT);
  usePresence.setState(INITIAL_PRESENCE);
});

describe('LocationSection', () => {
  it('shows distance and bearing on line 1 and ELEV on line 2', async () => {
    await act(async () => {
      usePresence.setState({ selfPosition: { position: HERE, accuracyM: 4, timestamp: 1, altitudeM: null } });
      useDraft.setState({ coord: THERE, category: 'unit', elevation: { at: THERE, m: 126 } });
    });
    await renderWithProviders(<LocationSection />);
    expect(screen.getByTestId('location-status')).toHaveTextContent(/km · .*\S/);
    expect(screen.getByTestId('location-status')).not.toHaveTextContent('@');
    expect(screen.getByTestId('location-elevation')).toHaveTextContent(/^ELEV 126 m/);
    expect(screen.queryByTestId('mgrs-status')).toBeNull();
    // Line 1 never wraps, so the block stays exactly two lines beside the buttons.
    expect(screen.getByTestId('location-status')).toHaveProp('numberOfLines', 1);
    expect(screen.getByTestId('location-status')).toHaveProp('adjustsFontSizeToFit', true);
  });

  it('says Valid when there is no position', async () => {
    await act(async () => useDraft.setState({ coord: THERE, category: 'unit' }));
    await renderWithProviders(<LocationSection />);
    expect(screen.getByTestId('location-status')).toHaveTextContent('Valid');
  });

  it('shows the MGRS error when the fields are invalid', async () => {
    await renderWithProviders(<LocationSection />);
    await fireEvent.changeText(screen.getByLabelText('MGRS zone'), '99Z');
    await fireEvent.changeText(screen.getByLabelText('100 km square'), 'UJ');
    await fireEvent.changeText(screen.getByLabelText('Easting'), '12345');
    await fireEvent.changeText(screen.getByLabelText('Northing'), '12345');
    expect(screen.getByTestId('location-status').props.className).toContain('text-danger');
  });

  it('keeps a one-line status row when the fields are empty, and clamps invalid messages to one line', async () => {
    await renderWithProviders(<LocationSection />);
    expect(screen.getByTestId('location-status-line').props.className).toContain('min-h-5');
    expect(screen.queryByTestId('location-status')).toBeNull();
    await fireEvent.changeText(screen.getByLabelText('MGRS zone'), '99Z');
    await fireEvent.changeText(screen.getByLabelText('100 km square'), 'UJ');
    await fireEvent.changeText(screen.getByLabelText('Easting'), '12345');
    await fireEvent.changeText(screen.getByLabelText('Northing'), '12345');
    expect(screen.getByTestId('location-status')).toHaveProp('numberOfLines', 1);
    expect(screen.getByTestId('location-status')).toHaveProp('adjustsFontSizeToFit', true);
  });

  it('has CTR and Map buttons, and no elevation line for polygon centers', async () => {
    await act(async () => useDraft.setState({ category: 'polygon' }));
    await renderWithProviders(<LocationSection />);
    expect(screen.getByLabelText('Center')).toBeTruthy();
    expect(screen.getByLabelText('Map')).toBeTruthy();
    expect(screen.queryByTestId('location-elevation')).toBeNull();
  });
});
