import { renderHook, waitFor } from '@testing-library/react-native';

import { useSymbolThumbnail } from './use-symbol-thumbnail';

const mockGet = jest.fn(async (sidc: string, opts?: { trimmed?: boolean }) => ({ uri: `file:///s/${sidc}${opts?.trimmed ? '-trim' : ''}.png`, scale: 3 }));
jest.mock('./get-symbol-image', () => ({ getSymbolImage: (s: string, o?: { trimmed?: boolean }) => mockGet(s, o) }));

it('resolves the trimmed thumbnail, null until it is ready', async () => {
  const { result } = await renderHook(() => useSymbolThumbnail('GFGPGPPK------X'));
  await waitFor(() => expect(result.current).toEqual({ uri: 'file:///s/GFGPGPPK------X-trim.png' }));
  expect(mockGet).toHaveBeenCalledWith('GFGPGPPK------X', { trimmed: true });
});
