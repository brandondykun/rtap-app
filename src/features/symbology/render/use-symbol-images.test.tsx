import { act, renderHook, waitFor } from '@testing-library/react-native';

import { useSymbolImages } from './use-symbol-images';

const mockGet = jest.fn(async (sidc: string) => ({ uri: `file:///s/${sidc}.png`, scale: 3 }));
jest.mock('./get-symbol-image', () => ({ getSymbolImage: (s: string) => mockGet(s) }));

beforeEach(() => mockGet.mockClear());

describe('useSymbolImages', () => {
  it('resolves the given SIDCs into Mapbox image entries', async () => {
    const { result } = await renderHook(() => useSymbolImages(['A', 'B']));
    await waitFor(() => expect(Object.keys(result.current.images).sort()).toEqual(['A', 'B']));
    expect(result.current.images.A).toEqual({ url: 'file:///s/A.png', scale: 3 });
  });

  it('keeps the same record when nothing new resolves, and adds new SIDCs (e.g. an echelon change)', async () => {
    const { result, rerender } = await renderHook(({ s }: { s: string[] }) => useSymbolImages(s), { initialProps: { s: ['A'] } });
    await waitFor(() => expect(result.current.images.A).toBeTruthy());
    const first = result.current.images;
    await rerender({ s: ['A'] });
    expect(result.current.images).toBe(first);
    await rerender({ s: ['A', 'C'] });
    await waitFor(() => expect(result.current.images.C).toBeTruthy());
    expect(mockGet).toHaveBeenCalledTimes(2);
  });

  it('fetches a symbol the map reports missing', async () => {
    const { result } = await renderHook(() => useSymbolImages([]));
    await act(async () => result.current.request('Z'));
    await waitFor(() => expect(result.current.images.Z).toBeTruthy());
  });

  it('leaves a symbol out when it cannot be drawn', async () => {
    mockGet.mockResolvedValueOnce(null as never);
    const { result } = await renderHook(() => useSymbolImages(['BAD']));
    await waitFor(() => expect(mockGet).toHaveBeenCalled());
    expect(result.current.images.BAD).toBeUndefined();
  });
});
